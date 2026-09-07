"""Numerical contract checks, using no renderer, preview, images or external library.

Run with Python to check the GLB; with Blender and the saved blend to check both.
"""
from pathlib import Path
import hashlib
import json
import math
import struct

HERE = Path(__file__).resolve().parent
GLB = HERE.parents[1] / 'public' / 'models' / 'props-math.glb'
BASELINE = json.loads((HERE / 'baseline-bounds.json').read_text())['bounds']
IDS = ('puppy-ball', 'soft-bed', 'puppy-house', 'flower-hoop', 'water-bowl',
       'paw-flag', 'feeding-bowl', 'grooming-brush', 'dog-food')


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def bounds(points):
    lo = [min(p[a] for p in points) for a in range(3)]
    hi = [max(p[a] for p in points) for a in range(3)]
    return {'min': lo, 'max': hi, 'size': sub(hi, lo), 'center': [(a + b) / 2 for a, b in zip(lo, hi)]}


def ray(triangles, origin, direction):
    hits = []
    for a, b, c in triangles:
        e1, e2 = sub(b, a), sub(c, a)
        h = cross(direction, e2)
        det = dot(e1, h)
        if abs(det) < 1e-12:
            continue
        s = sub(origin, a)
        u = dot(s, h) / det
        q = cross(s, e1)
        v = dot(direction, q) / det
        t = dot(e2, q) / det
        if u >= -1e-7 and v >= -1e-7 and u + v <= 1 + 1e-7 and t >= 0:
            hits.append(t)
    require(bool(hits), f'No ray hit from {origin}')
    return [a + min(hits) * b for a, b in zip(origin, direction)]


def component_count(triangles):
    # Weld split UV/normal seam vertices before measuring actual geometry islands.
    adjacency = {}
    for tri in triangles:
        points = [tuple(round(c, 6) for c in p) for p in tri]
        for p in points:
            adjacency.setdefault(p, set()).update(points)
    count = 0
    unseen = set(adjacency)
    while unseen:
        count += 1
        stack = [unseen.pop()]
        while stack:
            fresh = adjacency[stack.pop()] & unseen
            unseen.difference_update(fresh)
            stack.extend(fresh)
    return count


def verify_glb(path=GLB):
    raw = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<4sII', raw)
    require(magic == b'glTF' and version == 2 and length == len(raw), 'Invalid GLB header')
    require(len(raw) <= 3_000_000, 'GLB exceeds hard 3 MB limit')
    chunks, offset = {}, 12
    while offset < len(raw):
        size, kind = struct.unpack_from('<I4s', raw, offset)
        require(size % 4 == 0 and offset + 8 + size <= len(raw), 'Invalid chunk')
        require(kind not in chunks, 'Duplicate chunk')
        chunks[kind] = raw[offset + 8:offset + 8 + size]
        offset += 8 + size
    require(set(chunks) == {b'JSON', b'BIN\x00'}, 'Unexpected GLB chunks')
    doc, binary = json.loads(chunks[b'JSON']), chunks[b'BIN\x00']
    for key in ('images', 'textures', 'samplers', 'cameras', 'skins', 'animations'):
        require(not doc.get(key), f'Forbidden {key}')
    require(not doc.get('extensionsRequired') and not doc.get('extensionsUsed'), 'Unexpected extensions')
    require(len(doc['buffers']) == 1 and 'uri' not in doc['buffers'][0], 'External buffer')
    require(doc['buffers'][0]['byteLength'] <= len(binary), 'Truncated binary buffer')
    materials = doc['materials']
    require(1 <= len(materials) <= 3, 'Material role budget')
    for mat in materials:
        pbr = mat['pbrMetallicRoughness']
        require(pbr.get('baseColorFactor', [1, 1, 1, 1]) == [1, 1, 1, 1], 'Nonwhite base material')
        require(pbr.get('metallicFactor', 1) == 0, 'Metallic material')
        require(mat.get('alphaMode', 'OPAQUE') == 'OPAQUE', 'Transparent material')
        require('baseColorTexture' not in pbr and not mat.get('extensions'), 'Texture or non-Principled material')
    nodes = doc['nodes']
    names = [n.get('name') for n in nodes]
    require(len(names) == len(set(names)), 'Duplicate node names')
    require(names.count('math-props') == 1, 'Missing identity root')
    root_index = names.index('math-props')
    require(len(doc['scenes']) == 1 and doc['scenes'][0]['nodes'] == [root_index], 'Unexpected scene roots')
    root = nodes[root_index]
    require({names[i] for i in root['children']} == set(IDS), 'Direct part IDs mismatch')
    require(len(nodes) == 19 and len(doc['meshes']) == 9, 'Expected root + nine groups + nine meshes')
    for node in nodes:
        require(node.get('translation', [0, 0, 0]) == [0, 0, 0], 'Nonidentity translation')
        require(node.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1], 'Nonidentity rotation')
        require(node.get('scale', [1, 1, 1]) == [1, 1, 1], 'Nonidentity scale')
        identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        require(node.get('matrix', identity) == identity, 'Nonidentity matrix')
        require('skin' not in node and 'camera' not in node and not node.get('extensions'), 'Forbidden node content')

    def accessor(index):
        acc = doc['accessors'][index]
        require('sparse' not in acc, 'Unexpected sparse accessor')
        view = doc['bufferViews'][acc['bufferView']]
        require(view['buffer'] == 0, 'External buffer view')
        dims = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[acc['type']]
        fmt, size = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}[acc['componentType']]
        stride = view.get('byteStride', size * dims)
        local = acc.get('byteOffset', 0)
        require(local + (acc['count'] - 1) * stride + size * dims <= view['byteLength'], 'Accessor outside view')
        start = view.get('byteOffset', 0) + local
        result = [struct.unpack_from('<' + fmt * dims, binary, start + i * stride) for i in range(acc['count'])]
        if acc.get('normalized'):
            divisor = {5121: 255, 5123: 65535}[acc['componentType']]
            result = [tuple(v / divisor for v in row) for row in result]
        require(all(math.isfinite(v) for row in result for v in row), 'Nonfinite accessor')
        return result

    report, geometry = {}, {}
    total, max_normal_error, min_uv_area, min_area = 0, 0, math.inf, math.inf
    for part in IDS:
        group = nodes[names.index(part)]
        require('mesh' not in group and len(group['children']) == 1, f'{part}: expected identity group')
        child = nodes[group['children'][0]]
        require(not child.get('children'), f'{part}: nested children')
        primitives = doc['meshes'][child['mesh']]['primitives']
        require(1 <= len(primitives) <= 3, f'{part}: primitive budget')
        points, triangles = [], []
        for prim in primitives:
            require(prim.get('mode', 4) == 4 and not prim.get('targets'), 'Nonstatic triangles')
            require(set(prim['attributes']) == {'POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'}, 'Attribute contract')
            attrs = {key: accessor(value) for key, value in prim['attributes'].items()}
            positions, normals, uvs, colors = [attrs[k] for k in ('POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0')]
            require(len({len(v) for v in attrs.values()}) == 1, 'Attribute lengths')
            require(all(0 <= v <= 1 for row in colors for v in row), 'Color range')
            require(0 <= prim['material'] < len(materials), 'Missing material')
            for n in normals:
                error = abs(math.sqrt(dot(n, n)) - 1)
                max_normal_error = max(max_normal_error, error)
                require(error < 2e-5, 'Nonunit exported normal')
            indices = [row[0] for row in accessor(prim['indices'])]
            require(len(indices) % 3 == 0 and all(0 <= i < len(positions) for i in indices), 'Invalid indices')
            for j in range(0, len(indices), 3):
                a, b, c = [positions[i] for i in indices[j:j + 3]]
                normal = cross(sub(b, a), sub(c, a))
                area = math.sqrt(dot(normal, normal)) / 2
                ua, ub, uc = [uvs[i] for i in indices[j:j + 3]]
                uv_area = abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1])) / 2
                require(area > 1e-12 and uv_area > 1e-14, f'{part}: degenerate geometry or UV triangle')
                min_area, min_uv_area = min(min_area, area), min(min_uv_area, uv_area)
                triangles.append((a, b, c))
            points.extend(positions)
        measured = bounds(points)
        delta = max(abs(measured[key][i] - BASELINE[part][key][i]) for key in ('min', 'max') for i in range(3))
        require(delta <= .02, f'{part}: baseline bound drift {delta}')
        require(len(triangles) <= (8000 if part == 'puppy-house' else 3500), f'{part}: triangle budget')
        report[part] = {'bounds': measured, 'baseline_max_abs_delta': delta,
                        'triangles': len(triangles), 'primitives': len(primitives), 'vertices': len(points)}
        geometry[part] = triangles
        total += len(triangles)
    require(total <= 40000, 'Total triangle budget')
    return finish_glb_report(raw, report, geometry, total, materials, max_normal_error, min_uv_area, min_area)


def finish_glb_report(raw, parts, geo, total, materials, normal_error, uv_area, area):
    features = {}
    ball = parts['puppy-ball']['bounds']
    require(max(abs(a - b) for a, b in zip(ball['center'], (0, .3, 0))) < 1e-6, 'Ball pivot contract')
    radii = [math.sqrt(dot(sub(p, (0, .3, 0)), sub(p, (0, .3, 0)))) for tri in geo['puppy-ball'] for p in tri]
    require(abs(max(radii) - .3) < 1e-6 and min(radii) >= .295, 'Ball radius contract')
    features['ball_radius_range'] = [min(radii), max(radii)]
    for x, y in ((0, .28), (-.12, .28), (.12, .28), (0, .5)):
        hit = ray(geo['puppy-house'], (x, y, .8), (0, 0, -1))
        require(hit[2] < -.35, 'House entrance is obstructed')
    features['house_doorway_first_hit_z'] = hit[2]
    hit = ray(geo['puppy-house'], (.38, .3, .8), (0, 0, -1))
    require(.38 <= hit[2] <= .49, 'Missing front wall beside entrance')
    features['house_front_wall_hit_z'] = hit[2]
    hit = ray(geo['puppy-house'], (0, 1.3, .8), (0, 0, -1))
    require(.38 <= hit[2] <= .49, 'Gable is not upright')
    features['house_upright_gable_hit_z'] = hit[2]
    for part in ('soft-bed', 'feeding-bowl', 'water-bowl'):
        center_y = ray(geo[part], (0, 1, 0), (0, -1, 0))[1]
        rim_y = parts[part]['bounds']['max'][1]
        require(rim_y - center_y > (.20 if part == 'soft-bed' else .07), f'{part}: no real depression')
        features[part + '_center_y'] = center_y
        features[part + '_rim_depth'] = rim_y - center_y
    require(component_count(geo['dog-food']) == 9, 'Expected nine separate exported pellets')
    features['exported_kibble_components'] = 9
    return {'status': 'pass', 'coordinates': 'Y-up, identity root/groups/meshes',
            'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
            'total_triangles': total, 'total_primitives': sum(p['primitives'] for p in parts.values()),
            'materials': [m['name'] for m in materials], 'parts': parts, 'features': features,
            'max_normal_length_error': normal_error, 'min_triangle_area': area, 'min_uv_triangle_area': uv_area,
            'baseline_bounds_tolerance': .02, 'external_resources': 0, 'images_textures': 0,
            'cameras_lights_skins_animations': 0}


def verify_blend():
    import bpy
    import bmesh
    from mathutils import Matrix
    root = bpy.data.objects['math-props']
    require(root.parent is None and root.type == 'EMPTY', 'Blender root')
    require({ob.name for ob in root.children} == set(IDS), 'Blender direct IDs')
    require(not bpy.data.images and not bpy.data.cameras and not bpy.data.lights and
            not bpy.data.armatures and not bpy.data.actions, 'Forbidden Blender data')
    require(len(bpy.data.materials) <= 3, 'Blender material budget')
    require(bpy.context.preferences.filepaths.save_version == 0, 'Backup version must be zero')
    parts, closed_count = {}, 0
    for ob in bpy.context.scene.objects:
        require(ob.matrix_local == Matrix.Identity(4), f'{ob.name}: nonidentity Blender transform')
        require(ob.type in ('EMPTY', 'MESH'), f'{ob.name}: unexpected object type')
        if ob.type == 'MESH':
            require(ob.parent and ob.parent.name in IDS, f'{ob.name}: invalid parent')
            require(not ob.modifiers, f'{ob.name}: unapplied modifier')
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            require(all(edge.is_manifold for edge in bm.edges), f'{ob.name}: nonmanifold surface')
            require(bm.calc_volume(signed=True) > 1e-12, f'{ob.name}: inward or empty solid')
            bm.free()
            closed_count += 1
            require(all(p.area > 1e-12 for p in ob.data.polygons), f'{ob.name}: degenerate authored triangle')
            require('UVMap' in ob.data.uv_layers and 'Color' in ob.data.color_attributes, f'{ob.name}: missing attributes')
    for mat in bpy.data.materials:
        nodes = mat.node_tree.nodes
        bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        require(tuple(bsdf.inputs['Base Color'].default_value) == (1, 1, 1, 1), 'Blender nonwhite base')
        require(bsdf.inputs['Base Color'].is_linked and
                bsdf.inputs['Base Color'].links[0].from_node.type == 'VERTEX_COLOR', 'Vertex color not linked')

    def points(ob):
        return [(v.co.x, v.co.z, -v.co.y) for v in ob.data.vertices]

    for part in IDS:
        group = bpy.data.objects[part]
        require(group.type == 'EMPTY', f'{part}: not editable group')
        children = list(group.children)
        parts[part] = {'editable_components': len(children),
                                 'bounds': bounds([p for ob in children for p in points(ob)])}
    brush_base = bounds(points(bpy.data.objects['rounded-brush-base-038-014-052']))
    require(max(abs(a - b) for a, b in zip(brush_base['size'], (.38, .14, .52))) < 1e-6, 'Brush base dimensions')
    require(abs(parts['grooming-brush']['bounds']['min'][2] + .65) < 1e-6, 'Negative-Z handle end')
    shafts = [ob for ob in bpy.data.objects['grooming-brush'].children if ob.name.startswith('bristle-shaft')]
    require(len(shafts) == 24 and all(bounds(points(ob))['min'][1] < -.19 for ob in shafts), 'Bristles below Y -.13')
    brush = {'base_size': brush_base['size'], 'bristle_count': len(shafts), 'handle_min_z': -.65}
    food = list(bpy.data.objects['dog-food'].children)
    require(len(food) == 9, 'Nine editable pellets')
    pellet_centers = []
    for i in range(9):
        ob = bpy.data.objects[f'scored-kibble-{i:02}']
        center = bounds(points(ob))['center']
        target = (math.cos(i * 2.4) * .25, i % 2 * .04, math.sin(i * 2.4) * .25)
        require(max(abs(a - b) for a, b in zip(center, target)) < 1e-6, 'Pellet placement changed')
        pellet_centers.append(center)
    petals = [ob for ob in bpy.data.objects['flower-hoop'].children if '-petal-' in ob.name]
    require(len(petals) == 15, 'Expected three five-petal flowers')
    paw = [ob for ob in bpy.data.objects['paw-flag'].children if ob.name.startswith('raised-paw')]
    require(len(paw) == 5, 'Raised paw pad and four toes')
    for ob in paw:
        require(bounds(points(ob))['size'][2] > .025, 'Paw is not volumetric')
        offsets = [z - (.015 * math.sin(2 * math.pi * x / .54) +
                   .010 * x / .54 * math.sin(8 * (y - .85))) for x, y, z in points(ob)]
        require(min(offsets) < .004 and max(offsets) > .025, 'Paw applique is detached from cloth')
    cloth = bounds(points(bpy.data.objects['curved-thick-tricolor-cloth']))
    require(cloth['size'][2] > .025, 'Flag cloth is flat')
    return {'parts': parts, 'closed_manifold_components': closed_count, 'brush': brush,
            'pellet_centers': pellet_centers, 'shaped_petals': len(petals),
            'flag': {'raised_paw_components': len(paw), 'cloth_depth': cloth['size'][2]}}


if __name__ == '__main__':
    report = verify_glb()
    try:
        import bpy
    except ModuleNotFoundError:
        bpy = None
    if bpy is not None:
        bpy.context.preferences.filepaths.save_version = 0
        report['authoring'] = verify_blend()
    print(json.dumps(report, indent=2))
