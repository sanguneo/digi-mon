"""Fresh staging toy puppy. Blender background build and binary-only verification.

No render, preview, camera, image, external mesh, or runtime-asset dependency.
Authored coordinates are Y-up, +Z forward. P converts into Blender coordinates.
"""
import argparse
import hashlib
import json
import math
import struct
import sys
from collections.abc import Callable
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
PIVOTS = {'body': (0, 0, 0), 'head': (0, 1.6, .5), 'tail': (0, 1.03, -.94),
          'growth-collar': (0, 0, 0), 'growth-bandana': (0, 0, 0)}
PALETTE = {'cream': '#eed6ab', 'caramel': '#bd8550', 'off_white': '#fff3d9', 'chocolate': '#34251e'}
FEATURES = {}


def P(p):
    return Vector((p[0], -p[2], p[1]))


def app(p):
    return (p[0], p[2], -p[1])


def linear(value):
    values = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values)


COLORS = {key: linear(value) for key, value in PALETTE.items()}


def smoothstep(a, b, x):
    t = min(1., max(0., (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def blend(a, b, t):
    return tuple(x * (1 - t) + y * t for x, y in zip(a, b))


def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply(obj, modifier):
    active(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def smooth_normals(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def mesh(name, vertices, faces):
    data = bpy.data.meshes.new(name)
    data.from_pydata([P(v) for v in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    smooth_normals(obj)
    return obj


def rounded_volume(name, center, radii, exponent=1., segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    obj = bpy.context.object
    obj.name = name
    # Gently squared superellipses create broad toy forms instead of ball joints.
    for vertex in obj.data.vertices:
        q = app(vertex.co)
        vertex.co = P(tuple(center[i] + radii[i] * math.copysign(abs(q[i]) ** exponent, q[i]) for i in range(3)))
    return obj


def join(name, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name
    return objects[0]


def catmull(rows, steps):
    rows = [np.asarray(row, dtype=float) for row in rows]
    result = []
    for i in range(len(rows) - 1):
        a, b, c, d = rows[max(0, i - 1)], rows[i], rows[i + 1], rows[min(len(rows) - 1, i + 2)]
        for j in range(steps):
            t = j / steps
            result.append(.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t
                               + (-a + 3 * b - 3 * c + d) * t * t * t))
    return result + [rows[-1]]


def loft(name, sections, axis='z', sides=32, steps=5):
    rows = catmull(sections, steps)
    vertices, faces = [], []
    for x, y, z, r, s in rows:
        for j in range(sides):
            a = 2 * math.pi * j / sides
            vertices.append((x + r * math.cos(a), y + s * math.sin(a), z) if axis == 'z'
                            else (x + r * math.cos(a), y, z + s * math.sin(a)))
    for i in range(len(rows) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces += [tuple(reversed(range(sides))), tuple((len(rows) - 1) * sides + j for j in range(sides))]
    return mesh(name, vertices, faces)


def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def topology(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    unseen, sizes = set(bm.verts), []
    while unseen:
        todo, count = [unseen.pop()], 0
        while todo:
            vertex = todo.pop()
            count += 1
            for edge in vertex.link_edges:
                neighbor = edge.other_vert(vertex)
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    todo.append(neighbor)
        sizes.append(count)
    result = {'components': len(sizes), 'component_vertices': sorted(sizes, reverse=True),
              'nonmanifold_edges': sum(not edge.is_manifold for edge in bm.edges)}
    bm.free()
    return result


def sculpt(name, parts, voxel, budget):
    obj = join(name, parts)
    mod = obj.modifiers.new('Connected soft-volume union', 'REMESH')
    mod.mode, mod.voxel_size, mod.use_smooth_shade = 'VOXEL', voxel, True
    apply(obj, mod)
    mod = obj.modifiers.new('Sculpt blended junctions', 'SMOOTH')
    mod.factor, mod.iterations = 1., 8
    apply(obj, mod)
    if triangle_count(obj) > budget:
        mod = obj.modifiers.new('Useful mobile surface budget', 'DECIMATE')
        mod.ratio = budget / triangle_count(obj)
        apply(obj, mod)
    smooth_normals(obj)
    result = topology(obj)
    assert result['components'] == 1 and result['nonmanifold_edges'] == 0, (name, result)
    return obj


def material(name, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Roughness'].default_value = roughness
    color = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Color'
    mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    return mat


def paint(obj, mat, color: str | Callable[[float, float, float], tuple[float, ...]]):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    attribute = obj.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    for vertex, target in zip(obj.data.vertices, attribute.data):
        target.color = (*(color(*app(vertex.co)) if callable(color) else COLORS[color]), 1)
    obj.data.color_attributes.active_color = attribute
    obj.data.color_attributes.render_color_index = 0


def make_body(mat):
    parts = [loft('Squat capsule torso', [(0, .96, -1.08, .035, .035),
             (0, .97, -.94, .37, .36), (0, 1., -.64, .58, .49),
             (0, 1.04, -.19, .60, .51), (0, 1.08, .22, .53, .53),
             (0, 1.10, .51, .33, .38), (0, 1.10, .63, .035, .04)]),
             rounded_volume('Broad chest and neck bridge', (0, 1.32, .28), (.48, .48, .43), .92)]
    for side in (-1, 1):
        for z, x in ((.31, .46), (-.66, .48)):
            parts.append(loft('Short thick blended leg', [
                (side * x, .94, z, .25, .28), (side * (x + .015), .66, z, .23, .24),
                (side * (x + .025), .40, z + .025, .205, .225),
                (side * (x + .03), .20, z + .07, .23, .26)], axis='y'))
            parts.append(rounded_volume('Oversized planted paw',
                         (side * (x + .03), .135, z + .14), (.30, .18, .34), .84))
    obj = sculpt('PuppyV2_Body', parts, .025, 10500)
    for vertex in obj.data.vertices:
        vertex.co.z = max(0., vertex.co.z)

    def color(x, y, z):
        distance = (x / .57) ** 4 + ((z + .41) / .69) ** 4
        saddle = (1 - smoothstep(.85, 1.10, distance)) * smoothstep(1.19, 1.27, y)
        base = blend(COLORS['cream'], COLORS['caramel'], saddle)
        paws = 1 - smoothstep(.245, .29, y)
        bib = (1 - smoothstep(.80, 1.05, (x / .345) ** 4 + ((y - 1.16) / .43) ** 4))
        return blend(base, COLORS['off_white'], max(paws, bib * smoothstep(.51, .58, z)))

    paint(obj, mat, color)
    return obj


def make_ear(side):
    # Short thick droplet: attached upper-side root, flared belly, eye-level tip.
    return loft('Short rounded drop ear', [
        (side * .53, 2.24, .38, .035, .055), (side * .67, 2.17, .42, .145, .145),
        (side * .79, 2.035, .47, .185, .17), (side * .84, 1.88, .53, .175, .16),
        (side * .82, 1.765, .56, .10, .10), (side * .80, 1.735, .56, .025, .035)], axis='y')


def surface(obj, x, y, lift: float = 0.):
    hit, point, normal, _ = obj.ray_cast(P((x, y, 3)), P((0, 0, -1)))
    assert hit, ('Face attachment misses sculpt', x, y)
    return point + normal * lift, normal


def eye_volume(name, center, normal, radii):
    obj = rounded_volume(name, (0, 0, 0), radii, segments=24, rings=16)
    forward = normal.normalized()
    right = P((0, 1, 0)).cross(forward).normalized()
    up = forward.cross(right).normalized()
    for vertex in obj.data.vertices:
        x, y, z = app(vertex.co)
        vertex.co = center + right * x + up * y + forward * z
    return obj, (right, up, forward)


def tube(name, points, radius, cyclic=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions, curve.resolution_u = '3D', 6
    curve.bevel_depth, curve.bevel_resolution, curve.use_fill_caps = radius, 2, True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    spline.use_cyclic_u = cyclic
    for bp, point in zip(spline.bezier_points, points):
        bp.co = P(point)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    active(obj)
    bpy.ops.object.convert(target='MESH')
    smooth_normals(obj)
    return obj


def make_head(body_mat, detail_mat):
    head = sculpt('PuppyV2_Head', [
        rounded_volume('Broad toy cranium', (0, 1.67, .48), (.70, .74, .63), .94),
        rounded_volume('Single rounded low muzzle', (0, 1.43, 1.035), (.415, .275, .39), .94),
        make_ear(-1), make_ear(1)], .019, 12500)

    def color(x, y, z):
        ear = smoothstep(.635, .70, abs(x)) * smoothstep(1.68, 1.75, y)
        base = blend(COLORS['cream'], COLORS['caramel'], ear)
        muzzle = smoothstep(.97, 1.045, z) * (1 - smoothstep(1.64, 1.70, y))
        return blend(base, COLORS['off_white'], muzzle)

    paint(head, body_mat, color)
    details, eye_centers = [], []
    for side in (-1, 1):
        point, normal = surface(head, side * .405, 1.935, .004)
        eye_centers.append(list(app(point)))
        eye, (right, up, forward) = eye_volume('Modest outward-set oval eye', point, normal, (.078, .105, .037))
        paint(eye, detail_mat, 'chocolate')
        details.append(eye)
        # Small physically lit highlight disc: no glossy or emissive eyeball.
        dot_point = point - right * .023 + up * .036 + forward * .034
        dot, _ = eye_volume('Small highlight disc', dot_point, normal, (.018, .020, .005))
        paint(dot, detail_mat, 'off_white')
        details.append(dot)
    point, _ = surface(head, 0, 1.555, .024)
    nose = rounded_volume('Rounded bean nose', app(point), (.158, .098, .074), segments=32, rings=20)
    center = app(point)
    for vertex in nose.data.vertices:
        x, y, z = app(vertex.co)
        x *= 1 + .27 * (y - center[1]) / .098
        y -= .018 * math.exp(-((x / .055) ** 2)) * max(0, (y - center[1]) / .098)
        vertex.co = P((x, y, z))
    paint(nose, detail_mat, 'chocolate')
    details.append(nose)
    points = [app(surface(head, x, y, .005)[0]) for x, y in
              ((-.205, 1.402), (-.12, 1.361), (0, 1.355), (.12, 1.361), (.205, 1.402))]
    mouth = tube('Tiny soft smile', points, .009)
    paint(mouth, detail_mat, 'chocolate')
    details.append(mouth)
    lip = tube('Short muzzle center line', [app(surface(head, 0, y, .006)[0]) for y in (1.468, 1.41, 1.355)], .008)
    paint(lip, detail_mat, 'chocolate')
    details.append(lip)
    FEATURES.update({'eye_centers_y_up': eye_centers, 'eye_authored_height': .21, 'eye_authored_width': .156,
        'eye_center_separation': abs(eye_centers[1][0] - eye_centers[0][0]), 'cranium_authored_height': 1.48,
        'ear_authored_y_range': [1.735, 2.24], 'visible_lower_leg_region_y': [.29, .58],
        'paw_authored_width': .60, 'muzzle_sculpt_front_z': max(app(v.co)[2] for v in head.data.vertices)})
    return head, join('PuppyV2_Face', details)


def make_tail(mat):
    rows = catmull([(0, 1.03, -.92, .155), (.025, 1.12, -1.105, .15),
        (.06, 1.32, -1.235, .137), (.085, 1.51, -1.19, .119),
        (.09, 1.58, -1.04, .10), (.08, 1.51, -.955, .065), (.075, 1.455, -.97, .012)], 6)
    vertices, faces, sides = [], [], 24
    for i, row in enumerate(rows):
        center, radius = row[:3], row[3]
        tangent = rows[min(len(rows) - 1, i + 1)][:3] - rows[max(0, i - 1)][:3]
        tangent /= np.linalg.norm(tangent)
        right = np.cross(tangent, (1, 0, 0))
        right /= np.linalg.norm(right)
        up = np.cross(right, tangent)
        for j in range(sides):
            a = 2 * math.pi * j / sides
            vertices.append(center + radius * (right * math.cos(a) + up * math.sin(a)))
    for i in range(len(rows) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces += [tuple(reversed(range(sides))), tuple((len(rows) - 1) * sides + j for j in range(sides))]
    obj = mesh('PuppyV2_Tail', vertices, faces)
    paint(obj, mat, 'cream')
    return obj


def make_accessories(mat):
    points = [(.47 * math.cos(a), 1.275, .30 + .435 * math.sin(a))
              for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
    collar = tube('PuppyV2_Collar', points, .052, cyclic=True)
    paint(collar, mat, 'caramel')
    bandana = mesh('PuppyV2_Bandana', [(-.26, 1.265, .72), (-.13, 1.29, .77), (0, 1.30, .79),
        (.13, 1.29, .77), (.26, 1.265, .72), (-.15, 1.08, .715), (0, 1.09, .795),
        (.15, 1.08, .715), (0, .89, .68)],
        [(0, 1, 6, 5), (1, 2, 6), (2, 3, 6), (3, 4, 7, 6), (5, 6, 8), (6, 7, 8)])
    mod = bandana.modifiers.new('Soft fabric thickness', 'SOLIDIFY')
    mod.thickness = .035
    apply(bandana, mod)
    mod = bandana.modifiers.new('Friendly rounded cloth corners', 'BEVEL')
    mod.width, mod.segments = .03, 3
    apply(bandana, mod)
    mod = bandana.modifiers.new('Soft drape', 'SUBSURF')
    mod.levels = 1
    apply(bandana, mod)
    paint(bandana, mat, 'off_white')
    return collar, bandana


def finish(obj, frame):
    active(obj)
    smooth_normals(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70), island_margin=.012)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.transform(Matrix.Translation(-frame.location))
    obj.parent = frame
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.location, obj.rotation_euler, obj.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)


def validate_glb(path):
    raw = path.read_bytes()
    assert struct.unpack_from('<III', raw) == (0x46546c67, 2, len(raw))
    length, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(raw[20:20 + length])
    binary_length, kind = struct.unpack_from('<II', raw, 20 + length)
    assert kind == 0x004e4942 and 28 + length + binary_length == len(raw)
    binary = raw[28 + length:]
    assert len(doc['buffers']) == 1 and 'uri' not in doc['buffers'][0]
    assert doc['buffers'][0]['byteLength'] <= len(binary)
    for name in ('textures', 'images', 'animations', 'skins', 'cameras'):
        assert not doc.get(name), name
    assert not doc.get('extensionsRequired') and not doc.get('extensionsUsed')
    nodes = {node['name']: node for node in doc['nodes']}
    assert len(nodes) == len(doc['nodes'])
    root = nodes['puppy-asset']
    assert root.get('translation', [0, 0, 0]) == [0, 0, 0]
    assert root.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1]
    assert root.get('scale', [1, 1, 1]) == [1, 1, 1]
    assert {doc['nodes'][i]['name'] for i in root['children']} == set(PIVOTS)
    for name, pivot in PIVOTS.items():
        assert np.allclose(nodes[name].get('translation', [0, 0, 0]), pivot, atol=1e-6)
    widths = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    types = {5121: '<u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}

    def values(index):
        acc = doc['accessors'][index]
        view = doc['bufferViews'][acc['bufferView']]
        dtype, width = np.dtype(types[acc['componentType']]), widths[acc['type']]
        offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        stride = view.get('byteStride', width * dtype.itemsize)
        assert offset + (acc['count'] - 1) * stride + width * dtype.itemsize <= len(binary)
        result = np.ndarray((acc['count'], width), dtype=dtype, buffer=binary,
                            offset=offset, strides=(stride, dtype.itemsize))
        assert np.isfinite(result).all()
        if acc.get('normalized'):
            result = result.astype(float) / np.iinfo(dtype).max
        return result

    meshes, bounds, visited = [], [np.full(3, np.inf), np.full(3, -np.inf)], set()

    def visit(index, parent):
        assert index not in visited
        visited.add(index)
        node = doc['nodes'][index]
        assert 'matrix' not in node and 'rotation' not in node and 'scale' not in node, node
        offset = parent + np.asarray(node.get('translation', [0, 0, 0]))
        if 'mesh' in node:
            for prim in doc['meshes'][node['mesh']]['primitives']:
                assert prim.get('mode', 4) == 4
                attrs = prim['attributes']
                assert {'POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'} <= attrs.keys()
                position, normal, uv, color = [values(attrs[key]) for key in ('POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0')]
                assert len(position) == len(normal) == len(uv) == len(color)
                error = float(np.max(np.abs(np.linalg.norm(normal, axis=1) - 1)))
                assert error < .001
                assert np.all((uv >= -1e-6) & (uv <= 1 + 1e-6)) and np.all(np.ptp(uv, axis=0) > .1)
                assert np.all((color >= 0) & (color <= 1))
                assert color.shape[1] in (3, 4)
                if color.shape[1] == 4:
                    assert np.all(color[:, 3] == 1)
                index_accessor = doc['accessors'][prim['indices']]
                assert index_accessor['componentType'] in (5121, 5123, 5125)
                assert not index_accessor.get('normalized')
                indices = values(prim['indices']).ravel().astype(np.intp)
                assert len(indices) % 3 == 0 and indices.max() < len(position)
                tris = position[indices.reshape(-1, 3)]
                areas = np.linalg.norm(np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]), axis=1) * .5
                assert np.all(areas > 1e-12), (node['name'], 'degenerate triangles', int(np.sum(areas <= 1e-12)))
                world = position + offset
                lo, hi = world.min(axis=0), world.max(axis=0)
                bounds[0], bounds[1] = np.minimum(bounds[0], lo), np.maximum(bounds[1], hi)
                meshes.append({'node': node['name'], 'triangles': len(indices) // 3, 'vertices': len(position),
                    'bounds_y_up': [lo.tolist(), hi.tolist()], 'max_normal_length_error': error,
                    'min_triangle_area': float(areas.min()), 'uv_min': uv.min(axis=0).tolist(), 'uv_max': uv.max(axis=0).tolist()})
        for child in node.get('children', []):
            visit(child, offset)

    for index in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visit(index, np.zeros(3))
    assert len(visited) == len(doc['nodes'])
    materials = []
    for mat in doc['materials']:
        pbr = mat['pbrMetallicRoughness']
        assert pbr.get('baseColorFactor', [1, 1, 1, 1]) == [1, 1, 1, 1]
        assert pbr.get('metallicFactor', 1) == 0 and pbr['roughnessFactor'] >= .8
        assert not mat.get('extensions') and mat.get('emissiveFactor', [0, 0, 0]) == [0, 0, 0]
        materials.append({'name': mat['name'], 'roughness': pbr['roughnessFactor'], 'metallic': 0, 'base_color': [1, 1, 1, 1]})
    triangles, dimensions = sum(row['triangles'] for row in meshes), bounds[1] - bounds[0]
    assert 20000 <= triangles <= 35000, triangles
    assert len(raw) <= 3_000_000 and len(meshes) <= 6 and len(materials) <= 3
    assert abs(bounds[0][1]) < 1e-6 and 2.35 < dimensions[1] < 2.45, bounds
    assert 1.7 < dimensions[0] < 2.2 and 2.3 < dimensions[2] < 3.3, dimensions
    assert 1.35 < bounds[1][2] < 1.5, bounds[1]
    source_topology = {obj.name: topology(obj) for obj in bpy.data.objects if obj.type == 'MESH'}
    for name in ('PuppyV2_Body', 'PuppyV2_Head', 'PuppyV2_Tail'):
        assert source_topology[name]['components'] == 1 and source_topology[name]['nonmanifold_edges'] == 0
    feet = [app(v.co) for v in bpy.data.objects['PuppyV2_Body'].data.vertices if abs(v.co.z) < 1e-7]
    contacts = [sum(x * side > .2 and (z > 0 if front else z < -.2) for x, y, z in feet)
                for side in (-1, 1) for front in (False, True)]
    assert min(contacts) > 5, contacts
    assert all(p.use_smooth for obj in bpy.data.objects if obj.type == 'MESH' for p in obj.data.polygons)
    assert not bpy.data.images and not bpy.data.cameras and not bpy.data.lights
    return {'status': 'PASS', 'blender_version': bpy.app.version_string, 'glb': str(path),
        'glb_bytes': len(raw), 'glb_sha256': hashlib.sha256(raw).hexdigest(), 'triangles': triangles,
        'mesh_primitives': len(meshes), 'materials': materials,
        'bounds_y_up': {'min': bounds[0].tolist(), 'max': bounds[1].tolist(), 'dimensions': dimensions.tolist()},
        'pivots_y_up': PIVOTS, 'primitives': meshes, 'source_topology': source_topology,
        'ground_contact_vertices_by_paw': contacts, 'features': FEATURES, 'palette_srgb': PALETTE,
        'attributes': ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'], 'images': 0, 'textures': 0,
        'animations': 0, 'skins': 0, 'smooth_normals': True, 'physically_lit': True,
        'visual_review_performed': False, 'thumbnails': False, 'backups': 0,
        'verification': 'GLB binary attributes, finite/unit/range data, indices/areas, budgets, hierarchy/pivots, ground contacts, source connectivity/manifoldness; no image inspection'}


def configure():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.file_preview_type = 'NONE'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=HERE / 'puppy-v2.glb', help='Explicit GLB destination; default is staging only')
    parser.add_argument('--verify-only', action='store_true', help='Validate saved staging blend and existing GLB without rebuilding')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    configure()
    output = args.output.resolve()
    if args.verify_only:
        bpy.ops.wm.open_mainfile(filepath=str(HERE / 'puppy-v2.blend'), load_ui=False)
        configure()
        FEATURES.update(json.loads(bpy.context.scene['puppy_v2_features']))
    else:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        for pool in (bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
            for datablock in list(pool):
                pool.remove(datablock)
        fur = material('PuppyV2 matte cream and caramel', .9)
        face_mat = material('PuppyV2 matte facial details', .84)
        cloth = material('PuppyV2 soft cloth', .96)
        root = bpy.data.objects.new('puppy-asset', None)
        bpy.context.collection.objects.link(root)
        frames = {}
        for name, pivot in PIVOTS.items():
            frame = bpy.data.objects.new(name, None)
            bpy.context.collection.objects.link(frame)
            frame.parent, frame.location = root, P(pivot)
            frames[name] = frame
        body = make_body(fur)
        head, face = make_head(fur, face_mat)
        tail = make_tail(fur)
        collar, bandana = make_accessories(cloth)
        for obj, name in ((body, 'body'), (head, 'head'), (face, 'head'), (tail, 'tail'),
                          (collar, 'growth-collar'), (bandana, 'growth-bandana')):
            finish(obj, frames[name])
        bpy.context.scene['puppy_v2_features'] = json.dumps(FEATURES)
        bpy.context.scene['puppy_v2_provenance'] = 'New authored toy puppy; numeric-only build; no generated images or source model imports'
        bpy.context.view_layer.update()
        bpy.ops.object.select_all(action='SELECT')
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
            export_yup=True, export_apply=True, export_texcoords=True, export_normals=True,
            export_materials='EXPORT', export_animations=False, export_cameras=False, export_lights=False)
        bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'puppy-v2.blend'), compress=True)
    report = validate_glb(output)
    report['blend_bytes'] = (HERE / 'puppy-v2.blend').stat().st_size
    report['source_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (HERE / 'asset-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('PUPPY_V2_REPORT ' + json.dumps(report))


if __name__ == '__main__':
    main()
