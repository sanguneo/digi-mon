"""Orchard tree v2: broader sculpted crown, folded foliage and articulated bark.

Run from repository root with Blender --background --factory-startup --threads 4
--python-exit-code 1 --python apps/web-garden/art/tree-v2/build_tree.py.
All authored tuples use final Three.js Y-up coordinates. No renders, previews,
images, textures, cameras, lights, downloads or external geometry are used.
"""
import hashlib
import json
import math
from pathlib import Path
import runpy
import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
GLB = HERE.parents[1] / 'public/models/tree.glb'
BLEND = HERE / 'tree.blend'
TAU = math.tau
AUTHORING = {}


def P(p):
    return Vector((p[0], -p[2], p[1]))


def rgb(value):
    c = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


def mix(a, b, t):
    return tuple(x * (1 - t) + y * t for x, y in zip(a, b))


def frame(name, parent=None, pivot=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent, obj.location = parent, P(pivot)
    obj.empty_display_type, obj.empty_display_size = 'PLAIN_AXES', .12
    return obj


def material(name, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Roughness'].default_value = roughness
    mat.diffuse_color = (1, 1, 1, 1)
    mat.use_backface_culling = True
    color = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Color'
    mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    return mat


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply(obj, mod):
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def mesh_topology(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    for face in obj.data.polygons:
        face.use_smooth = True
    obj.data.update()


class Geometry:
    """Closed editable shells batched by semantic role, not by color."""
    def __init__(self):
        self.vertices, self.faces, self.colors = [], [], []
        self.shells = 0

    def add(self, vertices, faces, colors):
        offset = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend(tuple(offset + i for i in f) for f in faces)
        self.colors.extend(colors)
        self.shells += 1

    def object(self, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([P(v) for v in self.vertices], [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        attr = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
        for target, color in zip(attr.data, self.colors):
            target.color = (*color, 1)
        mesh.color_attributes.active_color = attr
        mesh.color_attributes.render_color_index = 0
        mesh_topology(obj)
        obj['authored_shells'] = self.shells
        return obj


def catmull(points, steps=5):
    rows, output = [Vector(p) for p in points], []
    for i in range(len(rows) - 1):
        a, b, c, d = [rows[max(0, min(len(rows) - 1, j))] for j in (i - 1, i, i + 1, i + 2)]
        for j in range(steps):
            t = j / steps
            output.append(.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t
                                  + (-a + 3 * b - 3 * c + d) * t * t * t))
    return output + [rows[-1]]


def tube(geo, points, radii, color, sides=10, steps=4):
    """Parallel-transport sections follow a curved tapering centerline."""
    rows = catmull([(*p, r) for p, r in zip(points, radii)], steps)
    verts, faces, previous = [], [], None
    for i, row in enumerate(rows):
        center = Vector(row[:3])
        tangent = (Vector(rows[min(i + 1, len(rows) - 1)][:3])
                   - Vector(rows[max(0, i - 1)][:3])).normalized()
        if previous is None:
            reference = Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((1, 0, 0))
            u = tangent.cross(reference).normalized()
        else:
            u = (previous - tangent * previous.dot(tangent)).normalized()
        v, previous = tangent.cross(u).normalized(), u
        for j in range(sides):
            angle = TAU * j / sides
            verts.append(center + row[3] * (u * math.cos(angle) + v * math.sin(angle)))
    for i in range(len(rows) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.extend([tuple(reversed(range(sides))), tuple((len(rows) - 1) * sides + j for j in range(sides))])
    geo.add(verts, faces, [color] * len(verts))


def leaf(geo, base, direction, length, width, color, *, normal=(0, .8, .6),
         thick=.045, bend=.13, droop=.055, twist=.20, rings=10, sides=8, petal=False):
    """Closed broad elliptic blade with camber, midrib, rolled edge and pointed tips.
    Authored orientation lives in vertices, never in the motion node rotation.
    """
    base, d, n = Vector(base), Vector(direction).normalized(), Vector(normal)
    n = (n - d * n.dot(d)).normalized()
    w = d.cross(n).normalized()
    verts, colors, faces = [base], [mix(color, rgb('#9ab56b'), .3)], []
    for i in range(1, rings):
        t = i / rings
        profile = math.sin(math.pi * t) ** (.58 if petal else .70)
        # Rounded shoulders and a narrow tip, not spear-like primitive leaves.
        half_width = width * profile * (1 - (.04 if petal else .16) * t)
        center = base + d * (length * t) + n * (bend * math.sin(math.pi * t) - droop * t * t)
        roll = twist * (t - .2)
        across, up = w * math.cos(roll) + n * math.sin(roll), n * math.cos(roll) - w * math.sin(roll)
        for j in range(sides):
            angle = TAU * j / sides
            x, y = math.cos(angle), math.sin(angle)
            # Smoothly sweep the midrib, roll margins and vary the silhouette
            # continuously. Extra shape comes from existing vertices, not tessellation.
            camber = width * (.16 * (1 - x * x) + .035 * x * x * math.sin(t * math.pi * 1.4)) * profile
            verts.append(center + across * (half_width * x) + up * (thick * profile * y + camber))
            if petal:
                tint = mix(color, rgb('#ecc1af'), .26 * t + .08 * abs(x))
            else:
                tint = mix(color, rgb('#d2df8f'), .20 * max(0, y) ** 6 * (1 - .45 * t))
                tint = mix(tint, rgb('#2e5644'), .17 * max(0, -y))
                tint = mix(tint, rgb('#c0d280'), .12 * abs(x) ** 5 * math.sin(math.pi * t))
            colors.append(tint)
    tip = len(verts)
    verts.append(base + d * length - n * droop)
    colors.append(mix(color, rgb('#cccf86'), .2))
    for j in range(sides):
        faces.append((0, 1 + (j + 1) % sides, 1 + j))
    for i in range(rings - 2):
        for j in range(sides):
            a, b = 1 + i * sides + j, 1 + i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    for j in range(sides):
        faces.append((1 + (rings - 2) * sides + j, 1 + (rings - 2) * sides + (j + 1) % sides, tip))
    geo.add(verts, faces, colors)


def fruit_volume(geo, center, radius, color, *, rings=12, sides=20, flatten=.79, lobes=.065):
    """Squat four-lobed persimmon with a shoulder and recessed top."""
    c = Vector(center)
    verts = [c + Vector((0, radius * flatten * .86, 0))]
    colors, faces = [mix(color, rgb('#c38439'), .2)], []
    for i in range(1, rings):
        phi = math.pi * i / rings
        r = radius * math.sin(phi) ** .77
        y = radius * flatten * math.cos(phi) - radius * .11 * math.exp(-((phi / .36) ** 2))
        for j in range(sides):
            angle = TAU * j / sides
            lobe = 1 + lobes * math.cos(4 * angle) * math.sin(phi) ** 2
            verts.append(c + Vector((r * lobe * math.cos(angle), y, r * lobe * math.sin(angle))))
            tint = .17 * (1 + math.sin(angle + .7)) / 2 + .16 * (1 - math.cos(phi)) / 2
            colors.append(mix(color, rgb('#c95a2d'), tint))
    bottom = len(verts)
    verts.append(c - Vector((0, radius * flatten, 0)))
    colors.append(mix(color, rgb('#bd6731'), .25))
    for j in range(sides):
        faces.append((0, 1 + j, 1 + (j + 1) % sides))
    for i in range(rings - 2):
        for j in range(sides):
            a, b = 1 + i * sides + j, 1 + i * sides + (j + 1) % sides
            faces.append((a, a + sides, b + sides, b))
    for j in range(sides):
        faces.append((1 + (rings - 2) * sides + j, bottom, 1 + (rings - 2) * sides + (j + 1) % sides))
    geo.add(verts, faces, colors)


def finish(obj, parent, pivot, mat, role):
    obj.parent = parent
    for vertex in obj.data.vertices:
        vertex.co -= P(pivot)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj['role'] = role
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.008)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.calc_loop_triangles()
    AUTHORING[obj.name] = {'role': role, 'triangles': len(obj.data.loop_triangles),
                           'authored_shells': obj.get('authored_shells', 0)}
    return obj


def fused_wood(geo, name, voxel, budget, sprout=False):
    obj = geo.object(name)
    mod = obj.modifiers.new('Continuous root trunk branch union', 'REMESH')
    mod.mode, mod.voxel_size, mod.use_smooth_shade = 'VOXEL', voxel, True
    apply(obj, mod)
    mod = obj.modifiers.new('Rounded branch junctions', 'SMOOTH')
    mod.factor, mod.iterations = .9, 4
    apply(obj, mod)
    obj.data.calc_loop_triangles()
    if len(obj.data.loop_triangles) > budget:
        mod = obj.modifiers.new('Active stage geometry budget', 'DECIMATE')
        mod.ratio = budget / len(obj.data.loop_triangles)
        apply(obj, mod)
    mesh_topology(obj)
    for existing in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(existing)
    attr = obj.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    for vertex, target in zip(obj.data.vertices, attr.data):
        x, z, y = vertex.co
        if sprout:
            color = mix(rgb('#89704a'), rgb('#579654'), min(1, max(0, y * 2.3)))
        else:
            angle = math.atan2(z, x)
            groove = .5 + .5 * math.sin(angle * 7 + y * 1.5)
            warm_tip = min(1., max(0., y / 3.3))
            color = mix(rgb('#624632'), rgb('#b38a5e'), .24 + .20 * groove + .16 * warm_tip)
        target.color = (*color, 1)
    obj.data.color_attributes.active_color = attr
    obj.data.color_attributes.render_color_index = 0
    if not sprout:
        # A continuous low-amplitude bark relief; no disconnected ridges or
        # extra draw calls. Keep deformation below 2% of the trunk diameter.
        for vertex in obj.data.vertices:
            x, z, y = vertex.co
            radial = math.hypot(x, z)
            if radial > .04 and y < 1.8:
                weight = max(0., 1. - y / 1.8)
                angle = math.atan2(z, x)
                flute = .009 * weight * math.sin(angle * 7 + y * 1.5)
                vertex.co.x += flute * x / radial
                vertex.co.y += flute * z / radial
        mesh_topology(obj)
    return obj


def soil(stage, scale=1):
    geo = Geometry()
    fruit_volume(geo, (0, .068, 0), .56 * scale, rgb('#846045'), rings=8, sides=32, flatten=.12, lobes=.10)
    for i in range(7):
        a = i * 2.39996
        fruit_volume(geo, (.44 * scale * math.cos(a), .11, .37 * scale * math.sin(a)),
                     (.066 + .012 * (i % 3)) * scale, rgb('#bc9767'), rings=5, sides=8, flatten=.55)
    return finish(geo.object(f'stage-{stage}-soil'), STAGES[stage], (0, 0, 0), WOOD, 'soil-and-seed-stones')


def sprout():
    geo = Geometry()
    tube(geo, [(0, .09, 0), (.042, .42, -.01), (-.032, .73, 0), (0, 1, 0),
               (-.032, 1.2, .01), (0, 1.35, .02), (.035, 1.5, .008)],
         [.084, .068, .057, .047, .038, .030, .017], rgb('#629c52'), sides=12)
    for i in range(5):
        a = i * TAU / 5 + .2
        tube(geo, [(0, .20, 0), (.15 * math.cos(a), .105, .15 * math.sin(a)),
                   (.36 * math.cos(a), .073, .36 * math.sin(a))],
             [.072, .043, .018], rgb('#967a4f'), sides=10)
    finish(fused_wood(geo, 'stage-0-stem-roots', .012, 2400, True), STAGES[0], (0, 0, 0), WOOD, 'connected-stem-roots')
    soil(0)
    for side, name, pivot in [(-1, 'sprout-leaf-left', (0, 1, 0)), (1, 'sprout-leaf-right', (0, 1.35, .02))]:
        node, geo = frame(name, STAGES[0], pivot), Geometry()
        d = Vector((side, .42 if side == -1 else .40, .04)).normalized()
        base = Vector(pivot) + d * .13
        tube(geo, [pivot, Vector(pivot) + d * .07, base + d * .04], [.028, .023, .015], rgb('#81ac60'), sides=8)
        length = .93 if side == -1 else .99
        leaf(geo, base, d, length, .38, rgb('#50925a') if side == -1 else rgb('#7fa95b'),
             normal=(0, .5, 1), thick=.045, bend=.16, droop=.025, twist=side * .22, rings=16, sides=12)
        n = Vector((0, .5, 1))
        n = (n - d * n.dot(d)).normalized()
        w = d.cross(n).normalized()
        def blade_surface(t, x=0.):
            # Follow the actual rolled blade's upper surface, not a flat vein
            # chord hidden inside it. Keep relief slight and surface-attached.
            profile = math.sin(math.pi * t) ** .70
            roll = side * .22 * (t - .2)
            across = w * math.cos(roll) + n * math.sin(roll)
            up = n * math.cos(roll) - w * math.sin(roll)
            camber = .38 * (.16 * (1 - x * x) + .035 * x * x * math.sin(t * math.pi * 1.4)) * profile
            return (base + d * (length * t) + n * (.16 * math.sin(math.pi * t) - .025 * t * t)
                    + across * (.38 * profile * (1 - .16 * t) * x)
                    + up * (.045 * profile * math.sqrt(max(0., 1 - x*x)) + camber + .003))
        points = [blade_surface(t) for t in (.03, .25, .5, .74, .92)]
        tube(geo, points, [.008, .011, .009, .006, .0025], rgb('#b6ce80'), sides=6, steps=3)
        for t in (.31, .53):
            for sign in (-1, 1):
                tube(geo, [blade_surface(t), blade_surface(t + .075, sign * .38),
                           blade_surface(t + .16, sign * .72)],
                     [.005, .004, .0018], rgb('#a3c579'), sides=5, steps=2)
        finish(geo.object(name + '-blade'), node, pivot, LEAF, 'thick-sprout-leaf')


def branch_sites(stage):
    scale, sites = (.78 if stage == 1 else 1), []
    for level, (count, y, radius) in enumerate([(5, 2.20, .77), (5, 2.78, .69), (3, 3.27, .30)]):
        count = (4, 3, 2)[level] if stage == 1 else count
        for j in range(count):
            angle = TAU * j / count + (.33, .96, .31)[level] + .10 * math.sin(j * 1.8 + level)
            # A domed but intentionally unequal crown, avoiding radial starbursts.
            reach = radius * (1 + .09 * math.sin(j * 2.1 + level * .7))
            end = Vector((math.cos(angle) * reach + .06 * level, y + .09 * math.sin(j * 2.4 + .4), math.sin(angle) * reach)) * scale
            sites.append((end, angle, level, scale))
    return sites


def blossom(geo, center, outward, size=1.0):
    n = Vector(outward).normalized()
    u = n.cross(Vector((0, 1, 0))).normalized()
    v, center = n.cross(u).normalized(), Vector(center)
    for j in range(4):
        a = TAU * j / 4 + .25
        d = (u * math.cos(a) + v * math.sin(a) + n * .16).normalized()
        leaf(geo, center - n * .025, d, .20 * size, .115 * size, rgb('#fff0ce'), normal=n,
             thick=.025 * size, bend=.06 * size, droop=-.015 * size, twist=.10,
             rings=6, sides=6, petal=True)
    fruit_volume(geo, center, .061 * size, rgb('#e3b857'), rings=5, sides=8, flatten=.78, lobes=0)
    for j in range(3):
        a = j * TAU / 3
        start = center + (u * math.cos(a) + v * math.sin(a)) * .027 * size
        # The sub-pixel stamens are rounded pollen beads rather than expensive
        # curved cylinders; reserve those sections for the outer leaf silhouette.
        fruit_volume(geo, start + n * .052 * size, .017 * size, rgb('#dba54c'),
                     rings=3, sides=4, flatten=.85, lobes=0)


def mature(stage):
    sites = branch_sites(stage)
    scale = sites[0][3]
    pivot = (0, 1.6 if stage == 1 else 2.15, 0)
    canopy = frame(f'stage-{stage}-canopy', STAGES[stage], pivot)
    wood, leaves, reproductive, sockets = Geometry(), Geometry(), Geometry(), Geometry()
    trunk_points = [(0, .08, 0), (-.075, .57, .025), (.07, 1.20, -.035),
                    (-.065, 1.89, .025), (.08, 2.52, 0), (.015, 3.29, .02)]
    tube(wood, [Vector(p) * scale for p in trunk_points],
         [r * scale for r in (.245, .177, .14, .115, .075, .030)], rgb('#927049'), sides=14)
    for i in range(6):
        a = TAU * i / 6 + .15
        tube(wood, [Vector((0, .37, 0)) * scale,
                    Vector((.27 * math.cos(a), .14, .27 * math.sin(a))) * scale,
                    Vector((.59 * math.cos(a), .06, .59 * math.sin(a))) * scale],
             [r * scale for r in (.15, .102, .025)], rgb('#967147'), sides=12)
    leaf_count = 0
    for i, (end, angle, level, s) in enumerate(sites):
        start_y = (1.42, 2.04, 2.71)[level] * s
        start = Vector((0, start_y, 0))
        mid = start.lerp(end, .53) + Vector((0, -.08 * s, 0))
        tube(wood, [start, mid, end], [r * s for r in (.11 - level * .02, .064 - level * .012, .026)],
             rgb('#987348'), sides=10, steps=6)
        # Seat moving leaf/flower/fruit petioles inside the structural branch,
        # rather than meeting two flat tube caps at a fragile butt joint.
        attachment = end - (end - start).normalized() * (.14 * s)
        # A bark-colored, leaf-concealed flexible joint retains volume overlap
        # during the runtime's +.1Y / +.045rad canopy lift, not just at rest.
        fruit_volume(sockets, attachment, .125 * s, rgb('#a07a52'),
                     rings=5, sides=8, flatten=1.25, lobes=0)
        for j in range(6):
            azimuth = angle + (j - 2.5) * .54 + .08 * math.sin(i * 1.7)
            lift = (.12, .42, .76, .90, .50, .20)[j]
            d = Vector((math.cos(azimuth), lift, math.sin(azimuth))).normalized()
            base = end + d * (.035 + .025 * (j % 2)) * s
            tube(leaves, [attachment, base, base + d * .055 * s], [.021 * s, .017 * s, .01 * s], rgb('#799756'), sides=6, steps=2)
            color = rgb(('#527e50', '#759653', '#9db96a', '#477653', '#70965b')[(i + j + level) % 5])
            leaf(leaves, base, d, (.73 + .045 * ((i + j) % 3)) * s,
                 (.29 + .025 * (j % 2)) * s, color, normal=(.12 * math.cos(angle), 1, .36),
                 thick=.026 * s, bend=.115 * s, droop=.075 * s, twist=.34 * (-1 if j % 2 else 1), rings=9 if j in (0, 4, 5) else 10, sides=10)
            leaf_count += 1
        if stage == 2:
            for j in range(2):
                a = angle + (-.43 if j == 0 else .38)
                outward = Vector((math.cos(a), .3, math.sin(a))).normalized()
                center = end + outward * (.54 if j == 0 else .67) + Vector((0, -.025 + j * .19, 0))
                tube(reproductive, [attachment, end.lerp(center, .65), center], [.021, .015, .012], rgb('#759252'), sides=6, steps=2)
                blossom(reproductive, center, outward, 1.04 if j == 0 else .86)
        if stage == 3:
            outward = Vector((math.cos(angle), 0, math.sin(angle)))
            center = end + outward * .46 + Vector((0, -.20, 0))
            radius = .245 + .018 * (i % 3)
            fruit_volume(reproductive, center, radius, rgb(('#e99a42', '#e78c35', '#efad4c')[i % 3]))
            # The calyx and stalk penetrate the recessed shoulder slightly;
            # this avoids a detached crown floating over the fruit.
            top = center + Vector((0, radius * .66, 0))
            tube(reproductive, [attachment, top + Vector((-.018, .095, .01)), top], [.026, .021, .024], rgb('#80603a'), sides=8, steps=4)
            for j in range(4):
                a = angle + TAU * j / 4
                leaf(reproductive, top, (math.cos(a), -.16, math.sin(a)), .20, .078, rgb('#597b3e'),
                     normal=(0, 1, 0), thick=.022, bend=.025, droop=.015, rings=6, sides=6)
    obj = fused_wood(wood, f'stage-{stage}-trunk-roots-branches', .023 * scale, 4900)
    finish(obj, STAGES[stage], (0, 0, 0), WOOD, 'connected-trunk-roots-branches')
    soil(stage, scale)
    finish(leaves.object(f'stage-{stage}-leaf-sprays'), canopy, pivot, LEAF, 'layered-thick-leaf-sprays')
    socket_obj = finish(sockets.object(f'stage-{stage}-attachment-sockets'), canopy, pivot, WOOD, 'overlapping-bark-joints')
    socket_obj['joint_count'] = len(sites)
    canopy['leaf_count'], canopy['spray_count'] = leaf_count, len(sites)
    canopy['petiole_branch_overlap'] = .14 * scale
    if stage > 1:
        role = 'blossoms' if stage == 2 else 'fruit'
        obj = finish(reproductive.object(f'stage-{stage}-{role}'), canopy, pivot, SATIN, role)
        obj['blossom_count' if stage == 2 else 'fruit_count'] = len(sites) * (2 if stage == 2 else 1)
        if stage == 3:
            obj['calyx_count'], obj['calyx_lobes_per_fruit'] = len(sites), 4


def main():
    global WOOD, LEAF, SATIN, STAGES
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.file_preview_type = 'NONE'
    bpy.context.preferences.view.show_splash = False
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.cameras, bpy.data.lights, bpy.data.materials, bpy.data.images):
        for block in list(collection):
            collection.remove(block)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'SOLID'
    bpy.context.scene.render.threads_mode = 'FIXED'
    bpy.context.scene.render.threads = 4
    WOOD = material('Tree dry sculpted bark', .88)
    LEAF = material('Tree soft waxed foliage', .60)
    SATIN = material('Tree satin petals and fruit', .38)
    root = frame('tree-asset')
    root['asset_version'] = 2
    root['species_motif'] = 'Korean orchard persimmon (gam), stylized growth'
    root['coordinate_contract'] = 'Model-local Y-up; runtime owns stage visibility and world placement'
    STAGES = [frame(f'tree-stage-{i}', root) for i in range(4)]
    for i, stage in enumerate(STAGES):
        stage['stage_index'], stage['exclusive_stage'] = i, True
    sprout()
    for stage in (1, 2, 3):
        mature(stage)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='SELECT')
    GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_texcoords=True,
                              export_normals=True, export_materials='EXPORT', export_vertex_color='ACTIVE',
                              export_animations=False, export_cameras=False, export_lights=False,
                              export_image_format='NONE', export_extras=True)
    # Four exclusive stages remain editable; the consumer activates exactly one.
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), compress=True)
    verification = runpy.run_path(str(HERE / 'verify_tree.py'))
    report = verification['verify_glb'](GLB)
    report['blend'] = verification['verify_blend']()
    report['authoring'] = AUTHORING
    report['blender_version'] = bpy.app.version_string
    report['command'] = [bpy.app.binary_path, '--background', '--factory-startup', '--threads', '4',
                         '--python-exit-code', '1', '--python', 'apps/web-garden/art/tree-v2/build_tree.py']
    report['source_sha256'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in (HERE / 'build_tree.py', HERE / 'verify_tree.py')}
    report['blend_bytes'] = BLEND.stat().st_size
    report['blend_sha256'] = hashlib.sha256(BLEND.read_bytes()).hexdigest()
    (HERE / 'tree-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': report['status'], 'glb_bytes': report['bytes'],
                      'triangles': report['total_triangles'], 'stages': report['stages']}, indent=2))


if __name__ == '__main__':
    main()
