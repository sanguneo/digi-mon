"""Baby Shiba puppy. Reproducible Blender mesh/material build and verification.

This build exports geometry/materials only; optional visual review loads the GLB
in a separate scene so preview cameras and lights never enter runtime assets.
Authored coordinates are Y-up, +Z forward. P converts into Blender coordinates.
"""
import argparse
import hashlib
import json
import math
import os
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
PALETTE = {'cream': '#eed6ab', 'caramel': '#ce8a50', 'off_white': '#fff3d9', 'chocolate': '#34251e', 'ear_inner': '#ad734f', 'warm_shadow': '#d7b68a', 'cheek': '#ebc6a5', 'sage': '#739583'}
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
    # Deliberately low-frequency baby proportions: a compact oval torso, hidden
    # neck bridge and four slim continuous tapered legs. No anatomical haunch,
    # stacked paws, wrist/toe lobes or waist pinches.
    parts = [rounded_volume('Compact baby torso', (0, .77, -.28), (.57, .48, .79), 1.),
             rounded_volume('Hidden soft neck bridge', (0, 1.08, .25), (.415, .39, .37), 1.)]
    for side in (-1, 1):
        for z in (.28, -.65):
            # One restrained taper from its hidden torso root to a small round
            # sole. No stacked ellipsoid ankle or separate oversized boot/paw.
            parts.append(loft('Slim continuous baby leg', [
                (side * .31, 1.00, z - .04, .15, .18),
                (side * .36, .76, z, .17, .185),
                (side * .39, .49, z + .02, .16, .175),
                (side * .41, .25, z + .04, .155, .17),
                (side * .41, .105, z + .08, .18, .19),
                (side * .41, .025, z + .08, .168, .178),
                (side * .41, -.035, z + .08, .12, .13)], axis='y'))
    obj = sculpt('PuppyV3_Body', parts, .021, 10000)
    for vertex in obj.data.vertices:
        vertex.co.z = max(0., vertex.co.z)

    def color(x, y, z):
        # Shiba urajiro: warm tan back, cream belly/chest/socks. No noisy painted
        # muscle lines, artificial dark creases or saddle-shaped color lump.
        underside = 1 - smoothstep(.45, .70, y)
        chest = smoothstep(.26, .52, z) * (1 - smoothstep(.34, .49, abs(x)))
        paws = 1 - smoothstep(.20, .32, y)
        return blend(COLORS['caramel'], COLORS['off_white'], max(underside, chest, paws))

    paint(obj, mat, color)
    return obj


def make_ear(side):
    # Upright Shiba triangle with a broad attached root and a rounded tip.
    return loft('Rounded upright baby Shiba ear', [
        (side * .49, 1.87, .40, .145, .155),
        (side * .52, 2.045, .40, .195, .15),
        (side * .55, 2.18, .385, .130, .105),
        (side * .57, 2.285, .365, .060, .060),
        (side * .57, 2.335, .355, .014, .021)], axis='y')


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


def tube(name, points, radius, cyclic=False, resolution=6, bevel=2):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions, curve.resolution_u = '3D', resolution
    curve.bevel_depth, curve.bevel_resolution, curve.use_fill_caps = radius, bevel, True
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
    # Blender curve caps share positions but not indices. Weld their rims so
    # thin facial strokes/cloth hems are closed meshes, not uncapped strips.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    bm.to_mesh(obj.data)
    bm.free()
    smooth_normals(obj)
    return obj


def make_head(body_mat, detail_mat):
    head = sculpt('PuppyV3_Head', [
        rounded_volume('Clean round baby Shiba cranium', (0, 1.48, .48), (.78, .62, .58), 1.),
        rounded_volume('Short soft cream muzzle', (0, 1.285, .99), (.35, .22, .235), 1.),
        make_ear(-1), make_ear(1)], .017, 12000)

    def color(x, y, z):
        # A broad cream urajiro mask is color, not extra cheek geometry.
        cheek_edge = 1.43 + .34 * (min(1., abs(x) / .70) ** 1.7)
        urajiro = (1 - smoothstep(cheek_edge - .045, cheek_edge + .045, y))
        front = smoothstep(.28, .76, z)
        base = blend(COLORS['caramel'], COLORS['off_white'], urajiro * front)
        inner_width = max(.025, .16 * (1 - max(0., y - 2.04) / .35))
        inner = math.exp(-((abs(x) - .55) / inner_width) ** 4)
        inner *= smoothstep(2.025, 2.13, y) * (1 - smoothstep(2.22, 2.29, y))
        inner *= smoothstep(.43, .49, z) * .68
        return blend(base, COLORS['ear_inner'], inner)

    paint(head, body_mat, color)
    details, eye_centers = [], []
    for side in (-1, 1):
        point, normal = surface(head, side * .345, 1.585, .004)
        eye_centers.append(list(app(point)))
        eye, (right, up, forward) = eye_volume('Gentle low-set baby Shiba eye', point, normal, (.092, .120, .035))
        paint(eye, detail_mat, 'chocolate')
        details.append(eye)
        # One restrained physically lit glint, no sclera, emission, or giant eyeball.
        dot_point = point - right * .025 + up * .042 + forward * .033
        dot, _ = eye_volume('Small highlight disc', dot_point, normal, (.022, .024, .005))
        paint(dot, detail_mat, 'off_white')
        details.append(dot)
    point, _ = surface(head, 0, 1.345, .018)
    nose = rounded_volume('Rounded bean nose', app(point), (.115, .073, .052), segments=32, rings=20)
    center = app(point)
    for vertex in nose.data.vertices:
        x, y, z = app(vertex.co)
        x *= 1 + .27 * (y - center[1]) / .073
        y -= .011 * math.exp(-((x / .055) ** 2)) * max(0, (y - center[1]) / .073)
        vertex.co = P((x, y, z))
    paint(nose, detail_mat, 'chocolate')
    details.append(nose)
    points = [app(surface(head, x, y, .005)[0]) for x, y in
              ((-.165, 1.205), (-.09, 1.174), (0, 1.17), (.09, 1.174), (.165, 1.205))]
    mouth = tube('Tiny soft smile', points, .009)
    paint(mouth, detail_mat, 'chocolate')
    details.append(mouth)
    lip = tube('Short muzzle center line', [app(surface(head, 0, y, .006)[0]) for y in (1.285, 1.23, 1.17)], .008)
    paint(lip, detail_mat, 'chocolate')
    details.append(lip)
    FEATURES.update({'eye_centers_y_up': eye_centers, 'eye_authored_height': .24, 'eye_authored_width': .184, 'nose_probe_y': 1.345,
        'eye_center_separation': abs(eye_centers[1][0] - eye_centers[0][0]), 'cranium_authored_height': 1.24,
        'ear_authored_y_range': [1.87, 2.335], 'visible_lower_leg_region_y': [.0, .32],
        'paw_authored_width': .36, 'muzzle_sculpt_front_z': max(app(v.co)[2] for v in head.data.vertices)})
    return head, join('PuppyV3_Face', details)


def make_tail(mat):
    rows = catmull([(0, 1.03, -.92, .18), (.02, 1.21, -1.06, .19),
        (.045, 1.42, -1.05, .19), (.055, 1.50, -.86, .175),
        (.06, 1.38, -.72, .145), (.055, 1.265, -.79, .085), (.05, 1.29, -.865, .012)], 6)
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
    obj = mesh('PuppyV3_Tail', vertices, faces)
    paint(obj, mat, lambda x, y, z: blend(COLORS['caramel'], COLORS['off_white'],
        smoothstep(-.98, -.78, z) * smoothstep(1.18, 1.36, y)))
    return obj


def make_accessories(cloth, leather):
    # A broad, rounded leather band rather than a floating round cord. Eight
    # beveled profile samples follow the actual elliptical neck cross-section.
    vertices, faces, segments = [], [], 48
    profile = [(-.019, -.056), (-.011, -.071), (.011, -.071), (.025, -.056),
               (.025, .056), (.011, .071), (-.011, .071), (-.019, .056)]
    for i in range(segments):
        angle = 2 * math.pi * i / segments
        for radial, height in profile:
            vertices.append(((.47 + radial) * math.cos(angle), 1.275 + height,
                             .30 + (.435 + radial) * math.sin(angle)))
    for i in range(segments):
        for j in range(8):
            a, b = i * 8 + j, i * 8 + (j + 1) % 8
            faces.append((a, b, ((i + 1) % segments) * 8 + (j + 1) % 8,
                          ((i + 1) % segments) * 8 + j))
    collar = mesh('PuppyV3_Collar', vertices, faces)
    paint(collar, leather, 'caramel')
    collar_parts = [collar]
    for height in (1.222, 1.328):
        trim = tube('Inset collar edge piping', [(.493 * math.cos(a), height, .30 + .458 * math.sin(a))
                    for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)], .005, cyclic=True, resolution=3, bevel=0)
        paint(trim, leather, lambda x, y, z: blend(COLORS['caramel'], COLORS['off_white'], .36))
        collar_parts.append(trim)
    tag = rounded_volume('Soft oval collar tag', (.35, 1.18, .653), (.067, .086, .023), segments=20, rings=12)
    paint(tag, leather, 'off_white')
    collar_parts.append(tag)
    collar = join('PuppyV3_Collar', collar_parts)
    # Keep growth visible under the low baby jaw without growing a long neck.
    for vertex in collar.data.vertices:
        x, y, z = app(vertex.co)
        vertex.co = P((x, y - .26, z + .06))
    bandana = mesh('PuppyV3_Bandana', [(-.27, 1.265, .72), (-.14, 1.29, .79), (0, 1.30, .835),
        (.14, 1.29, .79), (.27, 1.265, .72), (-.15, 1.08, .76), (0, 1.09, .85),
        (.15, 1.08, .76), (0, .86, .715)],
        [(0, 1, 6, 5), (1, 2, 6), (2, 3, 6), (3, 4, 7, 6), (5, 6, 8), (6, 7, 8)])
    mod = bandana.modifiers.new('Real cloth thickness', 'SOLIDIFY')
    mod.thickness = .027
    apply(bandana, mod)
    mod = bandana.modifiers.new('Rounded tailored corners', 'BEVEL')
    mod.width, mod.segments = .022, 3
    apply(bandana, mod)
    mod = bandana.modifiers.new('Sculpted fabric fold', 'SUBSURF')
    mod.levels = 1
    apply(bandana, mod)
    paint(bandana, cloth, lambda x, y, z: blend(COLORS['sage'], COLORS['ear_inner'],
          .18 * math.exp(-((abs(x) - .12) / .055) ** 2)))
    # An inset woven border follows the cloth perimeter, not a hard metallic rim.
    hem = tube('Bandana warm stitched border', [(-.225, 1.25, .767), (-.13, 1.075, .79),
               (0, .90, .746), (.13, 1.075, .79), (.225, 1.25, .767)], .006, resolution=4, bevel=1)
    paint(hem, cloth, 'off_white')
    bandana = join('PuppyV3_Bandana', [bandana, hem])
    for vertex in bandana.data.vertices:
        x, y, z = app(vertex.co)
        vertex.co = P((x, y - .20, z - .05 - .20 * (1.30 - y)))
    FEATURES.update({'collar_profile': 'closed bevelled leather band with paired piping and oval tag',
                     'bandana': 'closed softly folded cloth with inset warm hem',
                     'continuous_slim_legs': 4, 'upright_shiba_ears': 2, 'anatomical_relief': 0})
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
    limb_metrics = {}

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
                uv_tris = uv[indices.reshape(-1, 3)]
                ab, ac = uv_tris[:, 1] - uv_tris[:, 0], uv_tris[:, 2] - uv_tris[:, 0]
                uv_areas = np.abs(ab[:, 0] * ac[:, 1] - ab[:, 1] * ac[:, 0]) * .5
                assert np.all(uv_areas > 1e-14), (node['name'], 'degenerate UVs')
                assert np.all(areas > 1e-12), (node['name'], 'degenerate triangles', int(np.sum(areas <= 1e-12)))
                world = position + offset
                if node['name'] == 'PuppyV3_Body':
                    region = world[(world[:, 1] >= .12) & (world[:, 1] <= .32)
                                   & (world[:, 2] > .05) & (world[:, 0] > .05)]
                    assert len(region) > 20
                    limb_metrics['front_right_lower_leg_width'] = float(np.ptp(region[:, 0]))
                    limb_metrics['sample_y_range'] = [.12, .32]
                    assert limb_metrics['front_right_lower_leg_width'] < .40
                lo, hi = world.min(axis=0), world.max(axis=0)
                bounds[0], bounds[1] = np.minimum(bounds[0], lo), np.maximum(bounds[1], hi)
                meshes.append({'node': node['name'], 'triangles': len(indices) // 3, 'vertices': len(position),
                    'bounds_y_up': [lo.tolist(), hi.tolist()], 'max_normal_length_error': error,
                    'min_triangle_area': float(areas.min()), 'min_uv_triangle_area': float(uv_areas.min()), 'uv_min': uv.min(axis=0).tolist(), 'uv_max': uv.max(axis=0).tolist()})
        for child in node.get('children', []):
            visit(child, offset)

    for index in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visit(index, np.zeros(3))
    assert len(visited) == len(doc['nodes'])
    materials = []
    for mat in doc['materials']:
        pbr = mat['pbrMetallicRoughness']
        assert pbr.get('baseColorFactor', [1, 1, 1, 1]) == [1, 1, 1, 1]
        assert pbr.get('metallicFactor', 1) == 0 and pbr['roughnessFactor'] >= .25
        assert not mat.get('extensions') and mat.get('emissiveFactor', [0, 0, 0]) == [0, 0, 0]
        materials.append({'name': mat['name'], 'roughness': pbr['roughnessFactor'], 'metallic': 0, 'base_color': [1, 1, 1, 1]})
    triangles, dimensions = sum(row['triangles'] for row in meshes), bounds[1] - bounds[0]
    assert 20000 <= triangles <= 35000, triangles
    assert len(raw) <= 3_000_000 and len(meshes) <= 8 and len(materials) <= 4
    assert abs(bounds[0][1]) < 1e-6 and 2.25 < dimensions[1] < 2.45, bounds
    assert 1.5 < dimensions[0] < 2.2 and 2.3 < dimensions[2] < 3.3, dimensions
    assert 1.20 < bounds[1][2] < 1.5, bounds[1]
    source_topology = {obj.name: topology(obj) for obj in bpy.data.objects if obj.type == 'MESH'}
    for name in ('PuppyV3_Body', 'PuppyV3_Head', 'PuppyV3_Tail'):
        assert source_topology[name]['components'] == 1 and source_topology[name]['nonmanifold_edges'] == 0
    feet = [app(v.co) for v in bpy.data.objects['PuppyV3_Body'].data.vertices if abs(v.co.z) < 1e-7]
    contacts = [sum(x * side > .2 and (z > 0 if front else z < -.2) for x, y, z in feet)
                for side in (-1, 1) for front in (False, True)]
    assert min(contacts) > 5, contacts
    assert all(row['nonmanifold_edges'] == 0 for row in source_topology.values()), source_topology
    assert all(p.use_smooth for obj in bpy.data.objects if obj.type == 'MESH' for p in obj.data.polygons)
    assert not bpy.data.images and not bpy.data.cameras and not bpy.data.lights
    return {'status': 'PASS', 'blender_version': bpy.app.version_string, 'glb': os.path.relpath(path, HERE).replace(os.sep, '/'),
        'glb_bytes': len(raw), 'glb_sha256': hashlib.sha256(raw).hexdigest(), 'triangles': triangles,
        'mesh_primitives': len(meshes), 'materials': materials,
        'bounds_y_up': {'min': bounds[0].tolist(), 'max': bounds[1].tolist(), 'dimensions': dimensions.tolist()},
        'pivots_y_up': PIVOTS, 'primitives': meshes, 'source_topology': source_topology,
        'ground_contact_vertices_by_paw': contacts, 'limb_metrics': limb_metrics, 'features': FEATURES, 'palette_srgb': PALETTE,
        'attributes': ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'], 'images': 0, 'textures': 0,
        'animations': 0, 'skins': 0, 'smooth_normals': True, 'physically_lit': True,
        'visual_review_performed': False, 'thumbnails': False, 'backups': 0,
        'verification': 'GLB binary attributes, finite/unit/range data, indices/areas, budgets, hierarchy/pivots, ground contacts, source connectivity/manifoldness; no image inspection'}


def configure():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.file_preview_type = 'NONE'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=HERE / 'puppy-v3.glb', help='Explicit GLB destination; default is staging only')
    parser.add_argument('--verify-only', action='store_true', help='Validate saved staging blend and existing GLB without rebuilding')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    configure()
    output = args.output.resolve()
    if args.verify_only:
        bpy.ops.wm.open_mainfile(filepath=str(HERE / 'puppy-v3.blend'), load_ui=False)
        configure()
        FEATURES.update(json.loads(bpy.context.scene['puppy_v3_features']))
    else:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        for pool in (bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
            for datablock in list(pool):
                pool.remove(datablock)
        fur = material('PuppyV3 matte Shiba fur', .82)
        face_mat = material('PuppyV3 satin eyes and nose', .30)
        cloth = material('PuppyV3 woven cloth', .94)
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
        leather = material('PuppyV3 soft leather collar', .57)
        collar, bandana = make_accessories(cloth, leather)
        for obj, name in ((body, 'body'), (head, 'head'), (face, 'head'), (tail, 'tail'),
                          (collar, 'growth-collar'), (bandana, 'growth-bandana')):
            finish(obj, frames[name])
        bpy.context.scene['puppy_v3_features'] = json.dumps(FEATURES)
        bpy.context.scene['puppy_v3_provenance'] = 'Project-authored v3 sculpt from procedural source; no downloaded models/textures or generated images'
        bpy.context.view_layer.update()
        bpy.ops.object.select_all(action='SELECT')
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
            export_yup=True, export_apply=True, export_texcoords=True, export_normals=True,
            export_materials='EXPORT', export_animations=False, export_cameras=False, export_lights=False)
        bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'puppy-v3.blend'), compress=True)
    report = validate_glb(output)
    report['blend_bytes'] = (HERE / 'puppy-v3.blend').stat().st_size
    report['source_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (HERE / 'asset-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('PUPPY_V3_REPORT ' + json.dumps(report))


if __name__ == '__main__':
    main()
