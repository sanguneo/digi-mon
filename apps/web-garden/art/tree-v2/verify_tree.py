"""Numerical GLB validator: standard Python, no image operations.

python apps/web-garden/art/tree-v2/verify_tree.py validates the actual GLB.
Blender --background tree.blend --python-exit-code 1 --python verify_tree.py
also validates the reopened editable scene. Neither command writes assets.
"""
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct

HERE = Path(__file__).resolve().parent
GLB = HERE.parents[1] / 'public/models/tree.glb'
PIVOTS = {'sprout-leaf-left': [0, 1, 0], 'sprout-leaf-right': [0, 1.35, .02],
          'stage-1-canopy': [0, 1.6, 0], 'stage-2-canopy': [0, 2.15, 0],
          'stage-3-canopy': [0, 2.15, 0]}


def near(a, b, tolerance=1e-5):
    return len(a) == len(b) and all(abs(x - y) <= tolerance for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def bounds(points):
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    return {'min': low, 'max': high, 'size': list(sub(high, low))}


def read_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', data)
    assert (magic, version, length) == (b'glTF', 2, len(data))
    offset, chunks = 12, []
    while offset < length:
        size, kind = struct.unpack_from('<II', data, offset)
        assert size % 4 == 0 and offset + 8 + size <= length
        chunks.append((kind, data[offset + 8:offset + 8 + size]))
        offset += 8 + size
    assert [kind for kind, _ in chunks] == [0x4e4f534a, 0x004e4942]
    doc, binary = json.loads(chunks[0][1]), chunks[1][1]
    assert len(doc['buffers']) == 1 and 'uri' not in doc['buffers'][0]
    assert 0 <= len(binary) - doc['buffers'][0]['byteLength'] <= 3
    assert not doc.get('images') and not doc.get('textures') and not doc.get('cameras')
    assert not doc.get('animations') and not doc.get('skins')
    assert 'KHR_lights_punctual' not in doc.get('extensions', {})
    for view in doc['bufferViews']:
        assert view['buffer'] == 0
        assert view.get('byteOffset', 0) + view['byteLength'] <= len(binary)
    return data, doc, binary


def accessor(doc, binary, index):
    a = doc['accessors'][index]
    assert 'sparse' not in a
    view = doc['bufferViews'][a['bufferView']]
    codes = {5120: ('b', 1, 127), 5121: ('B', 1, 255), 5122: ('h', 2, 32767),
             5123: ('H', 2, 65535), 5125: ('I', 4, 4294967295), 5126: ('f', 4, 1)}
    code, size, divisor = codes[a['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    stride = view.get('byteStride', size * width)
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    assert a.get('byteOffset', 0) + (a['count'] - 1) * stride + size * width <= view['byteLength']
    result = [struct.unpack_from('<' + code * width, binary, start + i * stride) for i in range(a['count'])]
    if a.get('normalized'):
        result = [tuple(max(-1, value / divisor) for value in row) for row in result]
    assert all(math.isfinite(value) for row in result for value in row), index
    if 'min' in a:
        assert near(a['min'], [min(row[i] for row in result) for i in range(width)])
    if 'max' in a:
        assert near(a['max'], [max(row[i] for row in result) for i in range(width)])
    return result


def topology(positions, triangles):
    """Weld export UV/normal splits by position, then test closed shells."""
    keys, welded, lookup = [], [], {}
    for p in positions:
        key = tuple(round(v, 7) for v in p)
        if key not in lookup:
            lookup[key] = len(keys)
            keys.append(p)
        welded.append(lookup[key])
    parents = list(range(len(keys)))

    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    edges, volumes, min_area = Counter(), [], math.inf
    for tri in triangles:
        a, b, c = [welded[i] for i in tri]
        assert len({a, b, c}) == 3, 'Degenerate welded triangle'
        pa, pb, pc = [positions[i] for i in tri]
        face = cross(sub(pb, pa), sub(pc, pa))
        area = math.sqrt(dot(face, face)) / 2
        assert area > 1e-12, ('Zero triangle area', area)
        min_area = min(min_area, area)
        volumes.append((a, dot(pa, cross(pb, pc)) / 6))
        for u, v in ((a, b), (b, c), (c, a)):
            edges[tuple(sorted((u, v)))] += 1
            parents[root(u)] = root(v)
    component_sizes = Counter(root(i) for i in range(len(keys)))
    component_volumes = Counter()
    for a, volume in volumes:
        component_volumes[root(a)] += volume
    return {'welded_vertices': len(keys), 'components': len(component_sizes),
            'component_vertex_counts': sorted(component_sizes.values(), reverse=True),
            'boundary_edges': sum(n == 1 for n in edges.values()),
            'nonmanifold_edges': sum(n > 2 for n in edges.values()),
            'min_triangle_area': min_area, 'signed_volume': sum(component_volumes.values()),
            'min_component_signed_volume': min(component_volumes.values())}


def verify_glb(path=GLB):
    data, doc, binary = read_glb(path)
    assert len(data) <= 5_000_000, ('GLB budget', len(data))
    materials = doc['materials']
    assert 1 <= len(materials) <= 3
    for mat in materials:
        pbr = mat['pbrMetallicRoughness']
        assert near(pbr.get('baseColorFactor', [1, 1, 1, 1]), [1, 1, 1, 1])
        assert pbr.get('metallicFactor', 1) == 0
        assert mat.get('alphaMode', 'OPAQUE') == 'OPAQUE'
        assert 'baseColorTexture' not in pbr
    nodes = doc['nodes']
    names = {n['name']: i for i, n in enumerate(nodes)}
    assert len(names) == len(nodes), 'Duplicate node names'
    root = names['tree-asset']
    assert doc['scenes'][doc.get('scene', 0)]['nodes'] == [root]
    stage_ids = [names[f'tree-stage-{i}'] for i in range(4)]
    assert set(nodes[root]['children']) == set(stage_ids)
    parents = {}
    for i, node in enumerate(nodes):
        assert near(node.get('rotation', [0, 0, 0, 1]), [0, 0, 0, 1]), node['name']
        assert near(node.get('scale', [1, 1, 1]), [1, 1, 1]), node['name']
        assert 'matrix' not in node
        translation = node.get('translation', [0, 0, 0])
        assert near(translation, PIVOTS.get(node['name'], [0, 0, 0])), (node['name'], translation)
        for child in node.get('children', []):
            assert child not in parents
            parents[child] = i
    assert len(parents) == len(nodes) - 1
    for stage, expected in ((1, 54), (2, 78), (3, 78)):
        canopy = nodes[names[f'stage-{stage}-canopy']]
        assert canopy['extras']['leaf_count'] == expected
        assert canopy['extras']['spray_count'] == (9 if stage == 1 else 13)
    for name in PIVOTS:
        i = names[name]
        stage = 0 if name.startswith('sprout') else int(name[6])
        assert parents[i] == stage_ids[stage]
        assert 'mesh' not in nodes[i] and nodes[i].get('children')
    stages, mesh_reports, occupied = [], {}, set()
    max_normal_error, min_uv_area = 0, math.inf
    for stage, stage_id in enumerate(stage_ids):
        points, roles, pending = [], [], [(stage_id, [0, 0, 0])]
        primitive_count, triangle_count, descendants = 0, 0, []
        while pending:
            index, parent_offset = pending.pop()
            assert index not in occupied
            occupied.add(index)
            node = nodes[index]
            descendants.append(node['name'])
            offset = [a + b for a, b in zip(parent_offset, node.get('translation', [0, 0, 0]))]
            pending.extend((child, offset) for child in node.get('children', []))
            if 'mesh' not in node:
                continue
            role = node['extras']['role']
            roles.append(role)
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                assert primitive.get('mode', 4) == 4
                assert 0 <= primitive['material'] < len(materials)
                attrs = primitive['attributes']
                assert {'POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'} <= attrs.keys()
                values = {key: accessor(doc, binary, value) for key, value in attrs.items()}
                pos, normals, uv, colors = [values[key] for key in ('POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0')]
                assert len(pos) == len(normals) == len(uv) == len(colors)
                assert all(0 <= c <= 1 for row in colors for c in row)
                assert all(len(row) == 3 or row[3] == 1 for row in colors)
                assert all(-1e-5 <= v <= 1.00001 for row in uv for v in row)
                error = max(abs(math.sqrt(dot(n, n)) - 1) for n in normals)
                assert error < 1e-4, (node['name'], error)
                max_normal_error = max(max_normal_error, error)
                indices = [row[0] for row in accessor(doc, binary, primitive['indices'])]
                assert len(indices) % 3 == 0 and min(indices) >= 0 and max(indices) < len(pos)
                triangles = [indices[i:i + 3] for i in range(0, len(indices), 3)]
                for tri in triangles:
                    a, b, c = [uv[i] for i in tri]
                    area = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
                    assert area > 1e-15, ('Collapsed UV triangle', node['name'], area)
                    min_uv_area = min(min_uv_area, area)
                topo = topology(pos, triangles)
                assert topo['boundary_edges'] == 0 and topo['nonmanifold_edges'] == 0, (node['name'], topo)
                assert topo['min_component_signed_volume'] > 0, (node['name'], 'Inverted/flat shell', topo)
                if role.startswith('connected-'):
                    assert topo['components'] == 1, (node['name'], 'Disconnected structural tree', topo)
                    assert parents[index] == stage_id, 'Trunk must not animate with canopy'
                mesh_reports[node['name']] = {'role': role, 'triangles': len(triangles),
                                              'bounds_local': bounds(pos), 'topology': topo,
                                              'metadata': node.get('extras', {})}
                points.extend(tuple(a + b for a, b in zip(p, offset)) for p in pos)
                primitive_count += 1
                triangle_count += len(triangles)
        stage_bounds = bounds(points)
        width, height, depth = stage_bounds['size']
        assert width <= 3.6 and depth <= 3.6, (stage, stage_bounds)
        low, high = [(1.6, 2.1), (2.6, 3.3), (3.4, 4.1), (3.4, 4.1)][stage]
        assert low <= height <= high, (stage, stage_bounds)
        assert -.04 <= stage_bounds['min'][1] <= .12
        assert triangle_count <= 35_000 and primitive_count <= 6, (stage, triangle_count, primitive_count)
        stages.append({'stage': stage, 'bounds': stage_bounds, 'triangles': triangle_count,
                       'primitives': primitive_count, 'roles': sorted(roles), 'nodes': sorted(descendants)})
    assert len(occupied) == len(nodes) - 1
    total = sum(stage['triangles'] for stage in stages)
    assert total <= 100_000
    assert stages[0]['bounds']['size'][1] < stages[1]['bounds']['size'][1] < stages[2]['bounds']['size'][1]
    assert stages[0]['bounds']['size'][0] < stages[1]['bounds']['size'][0]
    assert 'blossoms' not in stages[0]['roles'] + stages[1]['roles'] + stages[3]['roles']
    assert 'fruit' not in stages[0]['roles'] + stages[1]['roles'] + stages[2]['roles']
    blossoms, fruit = mesh_reports['stage-2-blossoms'], mesh_reports['stage-3-fruit']
    assert blossoms['metadata']['blossom_count'] == 26 and blossoms['triangles'] > 8000
    assert fruit['metadata']['fruit_count'] == fruit['metadata']['calyx_count'] == 13
    assert fruit['metadata']['calyx_lobes_per_fruit'] == 4
    assert fruit['topology']['signed_volume'] > .2
    assert blossoms['topology']['signed_volume'] > .005
    assert fruit['topology']['signed_volume'] > blossoms['topology']['signed_volume'] * 2
    for name in ('sprout-leaf-left-blade', 'sprout-leaf-right-blade'):
        size = mesh_reports[name]['bounds_local']['size']
        assert size[0] > .8 and size[1] > .3 and size[2] > .1
    return {'status': 'PASS', 'asset_version': 2, 'path': path.as_posix(),
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'glb_version': 2, 'generator': doc['asset'].get('generator'),
            'total_triangles': total, 'total_primitives': sum(s['primitives'] for s in stages),
            'material_count': len(materials), 'materials': materials,
            'embedded_buffers': 1, 'images': 0, 'textures': 0, 'cameras': 0, 'lights': 0,
            'coordinates': 'Three.js Y-up, model-local, no world placement offset',
            'root': 'tree-asset', 'identity_stage_roots': [f'tree-stage-{i}' for i in range(4)],
            'pivots': {name: nodes[names[name]].get('translation', [0, 0, 0]) for name in PIVOTS},
            'all_node_rotations_identity': True, 'all_node_scales_identity': True,
            'all_attributes_finite': True, 'max_normal_length_error': max_normal_error,
            'minimum_uv_triangle_area': min_uv_area, 'stages': stages, 'meshes': mesh_reports,
            'semantic_counts': {'sprout_leaves': 2, 'young_leaves': 54, 'mature_leaves': 78,
                                'blossoms': 26, 'fruits': 13, 'calyx_lobes': 52},
            'connectivity_method': 'Position-weld exported UV/normal seams at 1e-7; count edges and connected components',
            'closed_shells': True, 'structural_network_components_per_stage': [1, 1, 1, 1],
            'verification_surface': 'Actual GLB JSON and binary accessors; no visual evidence'}



def verify_articulation():
    """Probe actual closed Blender surfaces at runtime care poses, not only bounds."""
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree

    def components(mesh):
        neighbors = [set() for _ in mesh.vertices]
        for edge in mesh.edges:
            a, b = edge.vertices
            neighbors[a].add(b); neighbors[b].add(a)
        remaining, result = set(range(len(mesh.vertices))), []
        while remaining:
            todo, ids = [remaining.pop()], []
            while todo:
                i = todo.pop(); ids.append(i)
                for j in neighbors[i]:
                    if j in remaining:
                        remaining.remove(j); todo.append(j)
            result.append(ids)
        return result

    def penetration(bvh, points):
        # For an oriented, closed manifold the nearest face normal identifies
        # its interior. Use actual sample positions, not just sphere/AABB bounds.
        best = 0.
        for p in points:
            nearest, normal, _, distance = bvh.find_nearest(p)
            signed = (p - nearest).dot(normal)
            if signed < -1e-5:
                best = max(best, -signed)
        return best

    samples, minimum = 0, math.inf
    for stage in (1, 2, 3):
        wood = bpy.data.objects[f'stage-{stage}-trunk-roots-branches']
        bvh = BVHTree.FromObject(wood, bpy.context.evaluated_depsgraph_get())
        sockets = bpy.data.objects[f'stage-{stage}-attachment-sockets']
        groups = components(sockets.data)
        assert len(groups) == (9 if stage == 1 else 13)
        crown = bpy.data.objects[f'stage-{stage}-canopy']
        rest = crown.location.copy()
        for lift in (0., .25, .5, .75, 1.):
            crown.rotation_euler.y = -.045 * lift
            crown.location.z = rest.z + .1 * lift
            bpy.context.view_layer.update()
            for ids in groups:
                points = [sockets.matrix_world @ sockets.data.vertices[i].co for i in ids]
                # Edge midpoints resolve the low-poly hidden collar surface.
                group = set(ids)
                for edge in sockets.data.edges:
                    if all(i in group for i in edge.vertices):
                        a, b = (sockets.data.vertices[i].co for i in edge.vertices)
                        points.append(sockets.matrix_world @ ((a+b)*.5))
                depth = penetration(bvh, points)
                assert depth > .0001, ('Canopy joint detached', stage, lift, ids[0], depth)
                minimum = min(minimum, depth); samples += 1
        crown.location = rest; crown.rotation_euler.y = 0
    bpy.context.view_layer.update()
    stem = bpy.data.objects['stage-0-stem-roots']
    bvh = BVHTree.FromObject(stem, bpy.context.evaluated_depsgraph_get())
    for name, direction in (('sprout-leaf-left', -1), ('sprout-leaf-right', 1)):
        pivot = bpy.data.objects[name]
        blade = bpy.data.objects[name+'-blade']
        # Points at the stalk root stay inside the fused stem as its leaf swings.
        roots = [v.co for v in blade.data.vertices if v.co.length < .055]
        assert roots
        for lift in (0., .25, .5, .75, 1.):
            pivot.rotation_euler.y = -direction * .38 * lift
            bpy.context.view_layer.update()
            depth = penetration(bvh, [blade.matrix_world @ p for p in roots])
            assert depth > .0001, ('Sprout petiole detached', name, lift, depth)
            minimum = min(minimum, depth); samples += 1
        pivot.rotation_euler.y = 0
    bpy.context.view_layer.update()
    return {'status': 'PASS', 'sampled_joint_poses': samples,
            'canopy_lift_y': .1, 'canopy_rotation_z': .045,
            'sprout_leaf_rotation_z': .38, 'minimum_surface_overlap': round(minimum, 6),
            'method': 'Actual mesh vertex/edge samples against connected wood BVH, five care fractions'}

def verify_blend():
    import bpy
    assert len(bpy.data.cameras) == len(bpy.data.lights) == len(bpy.data.images) == 0
    assert bpy.context.scene.camera is None
    objects = list(bpy.context.scene.objects)
    assert {obj.type for obj in objects} == {'EMPTY', 'MESH'}
    assert len([obj for obj in objects if obj.parent is None]) == 1
    root = bpy.data.objects['tree-asset']
    assert near(root.location, [0, 0, 0])
    assert {obj.name for obj in root.children} == {f'tree-stage-{i}' for i in range(4)}
    for name, pivot in PIVOTS.items():
        obj = bpy.data.objects[name]
        assert near(obj.location, [pivot[0], -pivot[2], pivot[1]])
    for obj in objects:
        assert near(obj.rotation_euler, [0, 0, 0]) and near(obj.scale, [1, 1, 1])
        assert not obj.hide_render and not obj.hide_viewport
        if obj.type == 'MESH':
            assert not obj.modifiers and len(obj.data.uv_layers) == 1
            assert 'Color' in obj.data.color_attributes and len(obj.data.materials) == 1
    assert len(bpy.data.materials) == 3
    for mat in bpy.data.materials:
        shader = mat.node_tree.nodes.get('Principled BSDF')
        assert near(shader.inputs['Base Color'].default_value, [1, 1, 1, 1])
        links = list(shader.inputs['Base Color'].links)
        assert len(links) == 1 and links[0].from_node.bl_idname == 'ShaderNodeVertexColor'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                assert area.spaces.active.shading.type == 'SOLID'
    return {'status': 'PASS', 'objects': len(objects),
            'editable_meshes': sum(obj.type == 'MESH' for obj in objects),
            'cameras': 0, 'lights': 0, 'images': 0, 'materials': 3,
            'saved_viewport_shading': 'SOLID', 'unapplied_modifiers': 0,
            'articulated_joints': verify_articulation()}


if __name__ == '__main__':
    report = verify_glb()
    saved = json.loads((HERE / 'tree-report.json').read_text(encoding='utf-8'))
    assert saved['sha256'] == report['sha256'] and saved['stages'] == report['stages']
    for name, digest in saved['source_sha256'].items():
        assert hashlib.sha256((HERE / name).read_bytes()).hexdigest() == digest
    assert hashlib.sha256((HERE / 'tree.blend').read_bytes()).hexdigest() == saved['blend_sha256']
    import sys
    if 'bpy' in sys.modules:
        current = verify_blend()
        expected = dict(saved['blend'])
        measured_joints = current.pop('articulated_joints')
        saved_joints = dict(expected.pop('articulated_joints'))
        assert current == expected
        # Reopening rebuilds Blender's BVH/evaluated normals. Re-run every
        # positive overlap assertion, and compare this small signed-distance
        # measurement with a 0.0001 model-unit tolerance, not bit equality.
        measured_overlap = measured_joints.pop('minimum_surface_overlap')
        saved_overlap = saved_joints.pop('minimum_surface_overlap')
        assert abs(measured_overlap - saved_overlap) <= .0001
        assert measured_joints == saved_joints
    print(json.dumps({'status': 'PASS', 'bytes': report['bytes'],
                      'triangles': report['total_triangles'], 'stages': report['stages']}, indent=2))
