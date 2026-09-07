"""Original puppy-yard prop library. Run with Blender --background --python.

All design coordinates are the application's Y-up world units, converted into
Blender Z-up vertices; every object and group has an identity transform.
No renders, previews, image assets, network input, or random geometry.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
GLB = HERE.parents[1] / 'public' / 'models' / 'props-math.glb'
BASELINE = json.loads((HERE / 'baseline-bounds.json').read_text())['bounds']
TAU = math.tau
IDS = ['puppy-ball', 'soft-bed', 'puppy-house', 'flower-hoop', 'water-bowl',
       'paw-flag', 'feeding-bowl', 'grooming-brush', 'dog-food']
CREAM = '#fff2d6'
TEAL = '#6395a3'
WOOD = '#ac7953'
PARTS = {}
FEATURES = {}


def linear_color(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb) + (1,)


def xyz(p):
    return (p[0], -p[2], p[1])


def yup(v):
    return (v[0], v[2], -v[1])


def empty(name, parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    return ob


def make_material(name, roughness):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0
    vc = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Color'
    mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def finish(ob, part, color, role='matte', smooth=True):
    """Bake normals/UV/color on authored meshes, before any export joining."""
    ob.parent = PARTS[part]
    ob.data.materials.clear()
    ob.data.materials.append(MATERIALS[role])
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    for poly in ob.data.polygons:
        poly.use_smooth = smooth
    uv = ob.data.uv_layers.new(name='UVMap')
    col = ob.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for poly in ob.data.polygons:
        # Per-face dominant-axis projection guarantees nonzero-area UVs, even
        # for the vessel floor and tube caps. Islands overlap intentionally.
        axis = max(range(3), key=lambda a: abs(poly.normal[a]))
        axes = [a for a in range(3) if a != axis]
        for li in poly.loop_indices:
            co = ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv.data[li].uv = ((co[axes[0]] + 2) / 4, (co[axes[1]] + 2) / 4)
            col.data[li].color = linear_color(color(yup(co)) if callable(color) else color)
    ob.data.color_attributes.active_color = col
    vg = ob.vertex_groups.new(name=ob.name)
    vg.add(list(range(len(ob.data.vertices))), 1, 'REPLACE')
    FEATURES.setdefault(part, []).append(ob)
    return ob


def mesh(part, name, verts, faces, color, role='matte', smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in verts], [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(ob)
    return finish(ob, part, color, role, smooth)


def lathe(part, name, profile, color, role='matte', n=40, sx=1.0, sz=1.0, center=(0, 0, 0)):
    """Closed radial profile with true shared poles: no degenerate pole quads."""
    verts, rows, faces = [], [], []
    for r, y in profile:
        if r == 0:
            rows.append([len(verts)])
            verts.append((center[0], center[1] + y, center[2]))
        else:
            rows.append(list(range(len(verts), len(verts) + n)))
            verts.extend((center[0] + sx * r * math.cos(TAU * j / n), center[1] + y,
                          center[2] + sz * r * math.sin(TAU * j / n)) for j in range(n))
    for a, b in zip(rows, rows[1:]):
        for j in range(n):
            k = (j + 1) % n
            if len(a) == 1:
                faces.append((a[0], b[k], b[j]))
            elif len(b) == 1:
                faces.append((a[j], a[k], b[0]))
            else:
                faces.append((a[j], a[k], b[k], b[j]))
    return mesh(part, name, verts, faces, color, role)


def ellipsoid(part, name, center, radii, color, role='matte', n=16, rings=8, deform=None):
    verts = [(center[0], center[1] - radii[1], center[2])]
    for i in range(1, rings):
        v = -math.pi / 2 + math.pi * i / rings
        for j in range(n):
            u = TAU * j / n
            p = (math.cos(v) * math.cos(u), math.sin(v), math.cos(v) * math.sin(u))
            f = deform(u, v) if deform else 1
            verts.append(tuple(center[a] + radii[a] * p[a] * f for a in range(3)))
    top = len(verts)
    verts.append((center[0], center[1] + radii[1], center[2]))
    faces = []
    for j in range(n):
        k = (j + 1) % n
        faces.append((0, 1 + k, 1 + j))
        faces.append((top, 1 + (rings - 2) * n + j, 1 + (rings - 2) * n + k))
    for i in range(rings - 2):
        for j in range(n):
            k = (j + 1) % n
            a, b = 1 + i * n, 1 + (i + 1) * n
            faces.append((a + j, a + k, b + k, b + j))
    return mesh(part, name, verts, faces, color, role)


def tube(part, name, points, radius, color, role='matte', sides=8, closed=False):
    pts = [Vector(p) for p in points]
    verts, faces = [], []
    for i, p in enumerate(pts):
        tangent = (pts[(i + 1) % len(pts)] - pts[(i - 1) % len(pts)] if closed else
                   pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        guide = Vector((0, 0, 1)) if abs(tangent.z) < .85 else Vector((1, 0, 0))
        side = tangent.cross(guide).normalized()
        up = tangent.cross(side).normalized()
        r = radius(i / max(1, len(pts) - 1)) if callable(radius) else radius
        for j in range(sides):
            verts.append(tuple(p + r * (side * math.cos(TAU * j / sides) + up * math.sin(TAU * j / sides))))
    for i in range(len(pts) if closed else len(pts) - 1):
        for j in range(sides):
            a, b = i * sides, ((i + 1) % len(pts)) * sides
            faces.append((a + j, a + (j + 1) % sides, b + (j + 1) % sides, b + j))
    if not closed:
        faces.extend([tuple(reversed(range(sides))), tuple((len(pts) - 1) * sides + j for j in range(sides))])
    return mesh(part, name, verts, faces, color, role)


def torus(part, name, center, rx, rz, radius, color, vertical=False, role='matte', n=48, sides=8):
    points = [(center[0] + rx * math.cos(TAU * j / n),
               center[1] + (rz * math.sin(TAU * j / n) if vertical else 0),
               center[2] + (0 if vertical else rz * math.sin(TAU * j / n))) for j in range(n)]
    return tube(part, name, points, radius, color, role, sides, True)


def solid_polygon(part, name, polygon, zmin, zmax, color, bevel=.008, role='matte'):
    """Extruded 2D outline; concave outlines keep real openings, not painted doors."""
    n = len(polygon)
    verts = [(x, y, z) for z in (zmin, zmax) for x, y in polygon]
    faces = [tuple(reversed(range(n))), tuple(n + i for i in range(n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in verts], [], faces)
    ob = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    if bevel:
        mod = ob.modifiers.new("Soft manufactured edges", "BEVEL")
        mod.width, mod.segments = bevel, 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.select_set(False)
    return finish(ob, part, color, role, smooth=False)


def box(part, name, low, high, color, bevel=.008, role='matte'):
    return solid_polygon(part, name, [(low[0], low[1]), (high[0], low[1]),
                         (high[0], high[1]), (low[0], high[1])], low[2], high[2], color, bevel, role)


def ball():
    part = 'puppy-ball'
    def seam(u, v):
        return abs(v - .48 * math.cos(2 * u))
    def tint(p):
        v = math.asin(max(-1, min(1, (p[1] - .3) / .3)))
        d = seam(math.atan2(p[2], p[0]), v)
        return CREAM if d < .105 else ('#cbd883' if v > 0 else '#b3c66b')
    ellipsoid(part, 'recessed-winding-tennis-seam', (0, .3, 0), (.3, .3, .3), tint,
              'satin', n=48, rings=24,
              deform=lambda u, v: 1 - .011 * math.exp(-(seam(u, v) / .08) ** 2))


def bed():
    part = 'soft-bed'
    # Continuous underside/bolster/inner-wall/cushion skin, not intersecting rings.
    lathe(part, 'padded-bolster-and-depressed-cushion',
          [(0, -.03), (.48, -.03), (.62, .005), (.685, .07), (.7, .15),
           (.685, .24), (.645, .32), (.59, .36363735), (.535, .345),
           (.48, .29), (.435, .19), (.37, .145), (.22, .13), (0, .115)],
          lambda p: '#c7c5da' if p[1] > .22 else '#aaaac3', 'fabric', n=48, sz=.9)
    torus(part, 'bolster-piping', (0, .325, 0), .642, .578, .007, '#e6def0', role='fabric', n=48, sides=6)
    for i in range(16):
        a = TAU * i / 16
        tube(part, f'cushion-stitch-{i:02}',
             [(.38 * math.cos(a + t), .153, .342 * math.sin(a + t)) for t in (-.026, .026)],
             .0025, '#e8deed', 'fabric', sides=5)


def house():
    part = 'puppy-house'
    box(part, 'raised-floor', (-.525, -.05, -.45), (.525, .025, .47), '#96704f', .012)
    for side in (-1, 1):
        x0, x1 = sorted((side * .455, side * .525))
        box(part, f'side-wall-{side}', (x0, .015, -.45), (x1, 1.045, .45), '#dfb57e')
    outline = [(-.525, .015), (-.525, 1.025), (0, 1.525), (.525, 1.025), (.525, .015)]
    solid_polygon(part, 'back-gable-wall', outline, -.45, -.38, '#d4a66f')
    # Concave U-shaped front: no surface spans the doorway.
    arch = [(.235 * math.cos(math.pi * i / 12), .36 + .25 * math.sin(math.pi * i / 12)) for i in range(13)]
    front = outline + [(.235, .015)] + arch + [(-.235, .015)]
    solid_polygon(part, 'open-arched-front-wall', front, .38, .45, '#e7bd86', .006)
    tube(part, 'arched-door-casing', [(-.255, .03, .462)] +
         [(.255 * math.cos(math.pi - math.pi * i / 16), .36 + .27 * math.sin(math.pi * i / 16), .462) for i in range(17)] +
         [(.255, .03, .462)], .021, '#f5d7a7', sides=8)
    for side in (-1, 1):
        poly = [(0, 1.555), (side * .66, 1.015), (side * .66, 1.075), (0, 1.615)]
        solid_polygon(part, f'sloped-roof-{side}', poly, -.55, .57, '#9a624e', .005)
    tube(part, 'front-gable-fascia', [(-.64, 1.03, .575), (0, 1.5827975, .575), (.64, 1.03, .575)],
         .04, '#edc78f', sides=8)
    for side in (-1, 1):
        tube(part, f'eave-{side}', [(side * .645, 1.04, -.53), (side * .645, 1.04, .565)],
             .022, '#714c3b', sides=6)
    for j, z in enumerate((-.39, -.18, .03, .24, .45)):
        tube(part, f'roof-board-lap-{j}', [(-.64, 1.088, z), (0, 1.616, z), (.64, 1.088, z)],
             .006, '#b67c5d', sides=6)
    for j, y in enumerate((.20, .38, .56, .74, .92)):
        gap = .272 if y < .64 else 0
        for side in (-1, 1):
            lo, hi = sorted((side * max(gap, .006), side * .513))
            box(part, f'front-plank-reveal-{j}-{side}', (lo, y, .45), (hi, y + .008, .456), '#b28459', .002)
            tube(part, f'side-plank-reveal-{j}-{side}', [(side * .527, y, -.36), (side * .527, y, .35)],
                 .004, '#b28459', sides=5)
    for x in (-.465, .465):
        for y in (.12, .86):
            ellipsoid(part, f'joinery-peg-{x}-{y}', (x, y, .458), (.012, .012, .005), '#845b40', n=8, rings=4)
    box(part, 'bone-plaque-middle', (-.105, .791, .458), (.105, .845, .477), CREAM, .006)
    for x in (-.105, .105):
        for y in (.791, .845):
            ellipsoid(part, f'bone-plaque-lobe-{x}-{y}', (x, y, .469), (.035, .035, .012), CREAM, n=10, rings=6)


def petal(part, name, center, angle, length, width, color):
    # Tapered cupped closed petal, pinched root and broad distal shoulder.
    radial = Vector((math.cos(angle), math.sin(angle), 0))
    lateral = Vector((-math.sin(angle), math.cos(angle), 0))
    verts, faces, rows = [tuple(Vector(center))], [], [[0]]
    for i in range(1, 6):
        t = i / 6
        row = []
        for j in range(8):
            a = TAU * j / 8
            p = Vector(center) + radial * (length * t) + lateral * (width * math.sin(math.pi * t) ** .7 * math.cos(a))
            p.z += .010 * math.sin(math.pi * t) * math.sin(a) + .012 * t * t
            row.append(len(verts))
            verts.append(tuple(p))
        rows.append(row)
    rows.append([len(verts)])
    verts.append(tuple(Vector(center) + radial * length + Vector((0, 0, .012))))
    for a, b in zip(rows, rows[1:]):
        for j in range(8):
            k = (j + 1) % 8
            faces.append((a[0], b[j], b[k]) if len(a) == 1 else
                         (a[j], b[0], a[k]) if len(b) == 1 else (a[j], b[j], b[k], a[k]))
    return mesh(part, name, verts, faces, color)


def hoop():
    part = 'flower-hoop'
    torus(part, 'continuous-hoop', (0, .68, 0), .58, .58, .055, '#d8b568', vertical=True, n=48)
    for i, (x, y) in enumerate(((-.4, 1.05), (0, 1.205), (.4, 1.05))):
        for j in range(5):
            petal(part, f'flower-{i}-petal-{j}', (x, y, .045), TAU * j / 5 + math.pi / 2,
                  .088, .031, '#edb4af' if j % 2 else '#f5cbc1')
        ellipsoid(part, f'flower-{i}-pollen-cushion', (x, y, .05225), (.03, .03, .016), '#f1d68c', n=12, rings=6)
        petal(part, f'flower-{i}-leaf', (x, y - .025, .015), -.6 if i % 2 else 3.7, .115, .024, '#8eae7a')


def bowl(part, water=False):
    lathe(part, 'hollow-vessel-rolled-rim',
          [(0, .01), (.425, .01), (.463, .02), (.47, .045), (.455, .09),
           (.418, .226), (.421, .248), (.412, .266), (.398, .2725),
           (.383, .268), (.373, .253), (.375, .23), (.349, .105),
           (.322, .071), (.27, .055), (0, .055)],
          lambda p: '#bfd6d2' if p[1] > .25 else '#6395a3', 'satin', n=48)
    torus(part, 'recessed-foot-band', (0, .044, 0), .468, .468, .002, '#446f7b', role='satin', n=48, sides=6)
    if water:
        lathe(part, 'inset-water-meniscus', [(0, .177), (.357, .177), (.362, .184), (.354, .188), (0, .183)],
              '#79bccb', 'satin', n=48)
        for i, r in enumerate((.115, .215)):
            tube(part, f'water-ripple-{i}', [(r * math.cos(a), .187, r * math.sin(a))
                 for a in [j * math.pi / 24 for j in range(15)]], .002, '#c7e9e6', 'satin', sides=5)


def flag_wave(x, y):
    return .015 * math.sin(2 * math.pi * x / .54) + .010 * x / .54 * math.sin(8 * (y - .85))


def flag():
    part = 'paw-flag'
    lathe(part, 'pole-and-rounded-finial', [(0, 0), (.035, 0), (.035, 1.315), (.031, 1.344), (0, 1.36)], WOOD, n=16)
    nx, ny = 18, 9
    verts, faces = [], []
    for side in (-1, 1):
        for j in range(ny + 1):
            for i in range(nx + 1):
                x = .015 + .525 * i / nx
                y = .875 + .39 * j / ny - .018 * math.sin(math.pi * i / nx)
                verts.append((x, y, flag_wave(x, y) + side * .004))
    stride, layer = nx + 1, (nx + 1) * (ny + 1)
    for s in range(2):
        for j in range(ny):
            for i in range(nx):
                a = s * layer + j * stride + i
                faces.append((a, a + 1, a + 1 + stride, a + stride))
    boundary = list(range(stride)) + [j * stride + nx for j in range(1, ny + 1)] + \
               [ny * stride + i for i in range(nx - 1, -1, -1)] + [j * stride for j in range(ny - 1, 0, -1)]
    faces += [(a, b, b + layer, a + layer) for a, b in zip(boundary, boundary[1:] + boundary[:1])]
    mesh(part, 'curved-thick-tricolor-cloth', verts, faces,
         lambda p: '#e89986' if p[1] > 1.135 else '#f4d277' if p[1] > 1.005 else '#8fbaa2', 'fabric')
    ellipsoid(part, 'raised-paw-central-pad', (.29, 1.049, .029), (.067, .062, .033), CREAM, 'fabric', n=16, rings=8,
              deform=lambda u, v: 1 + .08 * math.cos(3 * u) * math.cos(v))
    for i, (x, y, rx, ry) in enumerate(((.213, 1.113, .023, .033), (.258, 1.146, .026, .034),
                                       (.31, 1.148, .026, .034), (.357, 1.117, .023, .032))):
        ellipsoid(part, f'raised-paw-toe-{i}', (x, y, .028), (rx, ry, .028), CREAM, 'fabric', n=12, rings=6)
    for ob in FEATURES[part]:
        if ob.name.startswith('raised-paw'):
            for v in ob.data.vertices:
                x, y, z = yup(v.co)
                v.co = xyz((x, y, z + flag_wave(x, y)))
            ob.data.update()
    for y in (.9, 1.23):
        torus(part, f'flag-tie-{y}', (0, y, 0), .037, .037, .004, CREAM, role='fabric', n=12, sides=5)


def brush():
    part = 'grooming-brush'
    box(part, 'rounded-brush-base-038-014-052', (-.19, -.07, -.26), (.19, .07, .26),
        lambda p: '#ac7953' if math.sin(p[2] * 75 + p[0] * 11) > -.6 else '#bf9167', .035)
    box(part, 'inset-bristle-cushion', (-.16, -.082, -.224), (.16, -.063, .224), '#6f8888', .009)
    tube(part, 'contoured-negative-z-handle', [(0, .03, z) for z in (-.215, -.29, -.39, -.49, -.585)],
         lambda t: .043 + .022 * math.sin(math.pi * t), WOOD, sides=12)
    ellipsoid(part, 'rounded-handle-butt', (0, .03, -.585), (.057, .065, .065), WOOD, n=16, rings=8)
    for i in range(24):
        x, z = -.12 + (i % 4) * .08, -.18 + (i // 4) * .072
        tip = (x + .004 * (1 if x > 0 else -1), -.201, z + .003)
        tube(part, f'bristle-shaft-{i:02}', [(x, -.075, z), (x, -.14, z), tip],
             lambda t: .0085 - .002 * t, '#f0ddbd', sides=6)
        ellipsoid(part, f'rounded-bristle-tip-{i:02}', tip, (.008, .009, .008), CREAM, n=8, rings=4)


def food():
    part = 'dog-food'
    for i in range(9):
        center = (math.cos(i * 2.4) * .25, i % 2 * .04, math.sin(i * 2.4) * .25)
        ellipsoid(part, f'scored-kibble-{i:02}', center, (.07, .055, .07),
                  '#a87340' if i % 2 else '#b9854d', n=16, rings=8,
                  deform=lambda u, v: 1 - .045 * math.sin(3 * u) ** 2 * math.cos(v) ** 2 -
                  .025 * math.exp(-(v / .14) ** 2))


def main():
    global MATERIALS
    import hashlib
    import runpy
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.file_preview_type = 'NONE'
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for blocks in (bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for block in list(blocks):
            blocks.remove(block)
    MATERIALS = {role: make_material(f'Math white vertex {role}', roughness)
                 for role, roughness in [('matte', .82), ('fabric', .95), ('satin', .35)]}
    root = empty('math-props')
    root['coordinate_contract'] = 'Y-up local meters; identity frames; runtime owns placement'
    for part in IDS:
        PARTS[part] = empty(part, root)
    ball()
    bed()
    house()
    hoop()
    bowl('water-bowl', True)
    flag()
    bowl('feeding-bowl')
    brush()
    food()
    bpy.context.view_layer.update()
    verification = runpy.run_path(str(HERE / 'verify_props_math.py'))
    authoring = verification['verify_blend']()
    # Preserve named editable components. Join temporary duplicates only for export.
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'props-math.blend'), compress=True)
    export_objects = [root] + list(PARTS.values())
    for part in IDS:
        bpy.ops.object.select_all(action='DESELECT')
        copies = []
        for original in FEATURES[part]:
            ob = original.copy()
            ob.data = original.data.copy()
            bpy.context.scene.collection.objects.link(ob)
            ob.select_set(True)
            copies.append(ob)
        bpy.context.view_layer.objects.active = copies[0]
        if len(copies) > 1:
            bpy.ops.object.join()
        joined = bpy.context.object
        joined.name = f'{part}-geometry'
        export_objects.append(joined)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in export_objects:
        ob.select_set(True)
    GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB', use_selection=True,
        export_yup=True, export_apply=True, export_texcoords=True, export_normals=True,
        export_materials='EXPORT', export_vertex_color='ACTIVE', export_animations=False,
        export_cameras=False, export_lights=False, export_image_format='NONE', export_extras=True)
    report = verification['verify_glb'](GLB)
    report['authoring'] = authoring
    report['blender_version'] = bpy.app.version_string
    report['source_sha256'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in (HERE / 'build_props_math.py', HERE / 'verify_props_math.py')}
    blend = HERE / 'props-math.blend'
    report['blend_bytes'] = blend.stat().st_size
    report['blend_sha256'] = hashlib.sha256(blend.read_bytes()).hexdigest()
    report['command'] = [bpy.app.binary_path, '--background', '--factory-startup', '--threads', '4',
                         '--python-exit-code', '1', '--python', str(HERE / 'build_props_math.py')]
    (HERE / 'props-math-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
