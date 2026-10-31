"""Original puppy-yard prop library. Run with Blender --background --python.

All design coordinates are the application's Y-up world units, converted into
Blender Z-up vertices; every object and group has an identity transform.
The builder exports only authored geometry; the separate review script renders
actual GLB bytes without adding preview objects to the production library.
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
TEAL = '#799b91'
WOOD = '#ac7953'
PARTS = {}
FEATURES = {}


def linear_color(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb) + (1,)


def smoothstep(low, high, value):
    t = max(0., min(1., (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


def tint_mix(a, b, value):
    t = max(0., min(1., value))
    return tuple(x * (1 - t) + y * t for x, y in zip(linear_color(a), linear_color(b)))


def profile_curve(points, steps=2):
    """Low-frequency cardinal curves for real rounded vessel/cushion profiles."""
    result = []
    for i in range(len(points) - 1):
        a, b, c, d = points[max(0, i - 1)], points[i], points[i + 1], points[min(len(points) - 1, i + 2)]
        for j in range(steps):
            t = j / steps
            result.append(tuple(.5 * (2 * b[k] + (-a[k] + c[k]) * t +
                (2*a[k] - 5*b[k] + 4*c[k] - d[k]) * t*t +
                (-a[k] + 3*b[k] - 3*c[k] + d[k]) * t*t*t) for k in range(2)))
    return result + [points[-1]]


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
    mat.use_nodes = True
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
    # Blender 4.3 may reallocate CustomData when an attribute is added. Re-fetch
    # BOTH handles before writing; stale UV handles can overwrite color storage.
    uv = ob.data.uv_layers['UVMap']
    col = ob.data.color_attributes['Color']
    for poly in ob.data.polygons:
        # Per-face dominant-axis projection guarantees nonzero-area UVs, even
        # for the vessel floor and tube caps. Islands overlap intentionally.
        axis = max(range(3), key=lambda a: abs(poly.normal[a]))
        axes = [a for a in range(3) if a != axis]
        for li in poly.loop_indices:
            co = ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv.data[li].uv = ((co[axes[0]] + 2) / 4, (co[axes[1]] + 2) / 4)
            value = color(yup(co)) if callable(color) else color
            col.data[li].color = linear_color(value) if isinstance(value, str) else value
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


def lathe(part, name, profile, color, role='matte', n=40, sx=1.0, sz=1.0, center=(0, 0, 0), deform=None):
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
    if deform:
        verts = [deform(p) for p in verts]
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
        mod.width, mod.segments = bevel, 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.select_set(False)
    return finish(ob, part, color, role, smooth=False)


def box(part, name, low, high, color, bevel=.008, role='matte'):
    return solid_polygon(part, name, [(low[0], low[1]), (high[0], low[1]),
                         (high[0], high[1]), (low[0], high[1])], low[2], high[2], color, bevel, role)


def ball():
    part = 'puppy-ball'
    # Warp latitude rings onto the curved seam. Unlike a threshold painted on a
    # regular sphere grid, both groove and cream inlay follow continuous rings.
    rows = [-math.pi/2, -1.35, -1.15, -.95, -.75, -.55, -.35, -.19, -.11,
            -.065, -.035, 0., .035, .065, .11, .19, .35, .55, .75, .95, 1.15, 1.35, math.pi/2]
    verts, rings, faces, n = [], [], [], 64
    for t in rows:
        if abs(t) == math.pi/2:
            rings.append([len(verts)])
            verts.append((0, .3 + math.copysign(.3, t), 0))
            continue
        row = []
        for j in range(n):
            u = TAU*j/n
            v = t + .48*math.cos(2*u)*math.cos(t)**2
            radius = .3 - .0045*math.exp(-(t/.035)**2)
            row.append(len(verts))
            verts.append((radius*math.cos(v)*math.cos(u), .3+radius*math.sin(v), radius*math.cos(v)*math.sin(u)))
        rings.append(row)
    for a, b in zip(rings, rings[1:]):
        for j in range(n):
            k=(j+1)%n
            faces.append((a[0],b[k],b[j]) if len(a)==1 else
                         (a[j],a[k],b[0]) if len(b)==1 else (a[j],a[k],b[k],b[j]))
    def color(point):
        x, y, z = point[0], point[1]-.3, point[2]
        u, v = math.atan2(z,x), math.atan2(y,math.hypot(x,z))
        t=v
        for _ in range(8):
            t -= (t+.48*math.cos(2*u)*math.cos(t)**2-v)/(1-.96*math.cos(2*u)*math.cos(t)*math.sin(t))
        return tint_mix(CREAM, '#c5b773', smoothstep(.026,.074,abs(t)))
    mesh(part, 'continuous-recessed-tennis-inlay', verts, faces, color)


def bed():
    part = 'soft-bed'
    profile = [(0,-.03),(.48,-.03),(.62,.005),(.685,.07),(.7,.15),
               (.685,.24),(.645,.32),(.59,.36363735),(.535,.345),
               (.48,.29),(.435,.19),(.37,.125),(.22,.145),(.10,.158),(0,.16)]
    def form(p):
        x,y,z=p
        direction=z/max(.0001,math.hypot(x,z))
        # Lower only the front of the continuous roll into a calm walk-in edge.
        # The back stays at its existing maximum height; no segmented puffs.
        drop=max(0.,y-.16)*.55*smoothstep(.05,.9,direction)*smoothstep(.16,.24,y)
        return (x,y-drop,z)
    lathe(part,'continuous-soft-bolster-and-cushion',profile_curve(profile),
          lambda p:tint_mix('#cfa397',CREAM,
              (1-smoothstep(.39,.51,math.hypot(p[0],p[2]/.9)))*smoothstep(.07,.16,p[1])),
          'fabric',n=40,sz=.9,deform=form)
    tube(part,'soft-bolster-piping',
         [form((.642*math.cos(TAU*j/48),.325,.578*math.sin(TAU*j/48))) for j in range(48)],
         .0065,'#f6dfce','fabric',sides=6,closed=True)
    torus(part,'inset-cushion-seam',(0,.131,0),.38,.342,.003,'#e6d3ba',
          role='fabric',n=48,sides=4)


def house():
    part = 'puppy-house'
    box(part, 'raised-floor', (-.525, -.05, -.45), (.525, .025, .47), '#96704f', .012)
    for side in (-1, 1):
        x0, x1 = sorted((side * .455, side * .525))
        box(part, f'side-wall-{side}', (x0, .015, -.395), (x1, 1.125, .395), '#dfb57e')
    outline = [(-.525,.015),(-.525,1.125),(0,1.555),(.525,1.125),(.525,.015)]
    solid_polygon(part, 'back-gable-wall', outline, -.45, -.38, '#d4a66f')
    # Concave U-shaped front: no surface spans the doorway.
    arch = [(.265 * math.cos(math.pi * i / 16), .36 + .29 * math.sin(math.pi * i / 16)) for i in range(17)]
    front = outline + [(.265, .015)] + arch + [(-.265, .015)]
    solid_polygon(part, 'open-arched-front-wall', front, .38, .45, '#e7bd86', .006)
    tube(part, 'arched-door-casing', [(-.286, .03, .462)] +
         [(.286 * math.cos(math.pi - math.pi * i / 16), .36 + .31 * math.sin(math.pi * i / 16), .462) for i in range(17)] +
         [(.286, .03, .462)], .021, '#f5d7a7', sides=8)
    for side in (-1, 1):
        poly = [(0, 1.555), (side * .66, 1.015), (side * .66, 1.075), (0, 1.615)]
        roof = solid_polygon(part, f'soft-overhanging-roof-{side}', poly, -.55, .57, '#789888', .014)
        for vertex in roof.data.vertices:
            x,y,z=yup(vertex.co)
            vertex.co=xyz((x,y+.006*math.sin(math.pi*(z+.55)/1.12),z))
        roof.data.update()
    solid_polygon(part,'joined-rounded-gable-fascia',
        [(-.65,1.03),(-.64,1.09),(0,1.615),(.64,1.09),(.65,1.03),(0,1.555)],
        .551,.615,'#f1d6aa',.012)
    for side in (-1, 1):
        tube(part, f'eave-{side}', [(side * .645, 1.04, -.53), (side * .645, 1.04, .565)],
             .022, '#607f70', sides=6)
    for j, z in enumerate((-.39, -.18, .03, .24, .45)):
        tube(part, f'roof-board-lap-{j}', [(-.64, 1.088, z), (0, 1.616, z), (.64, 1.088, z)],
             .006, '#8eab9a', sides=6)
    for j, y in enumerate((.20, .38, .56, .74, .92)):
        gap = .309 if y < .70 else 0
        for side in (-1, 1):
            lo, hi = sorted((side * max(gap, .006), side * .513))
            box(part, f'front-plank-reveal-{j}-{side}', (lo, y, .45), (hi, y + .008, .456), '#b28459', .002)
            tube(part, f'side-plank-reveal-{j}-{side}', [(side * .527, y, -.36), (side * .527, y, .35)],
                 .004, '#b28459', sides=5)
    for x in (-.465, .465):
        for y in (.12, .86):
            ellipsoid(part, f'joinery-peg-{x}-{y}', (x, y, .458), (.012, .012, .005), '#845b40', n=8, rings=4)
    # One continuous softly beveled bone, not five intersecting little blobs.
    solid_polygon(part,'single-soft-bone-plaque',
        [(-.085,.795),(-.115,.772),(-.15,.784),(-.15,.813),(-.136,.824),
         (-.15,.84),(-.147,.867),(-.115,.876),(-.085,.852),(.085,.852),
         (.115,.876),(.147,.867),(.15,.84),(.136,.824),(.15,.813),
         (.15,.784),(.115,.772),(.085,.795)],.456,.482,CREAM,.008)


def petal(part, name, center, angle, length, width, color):
    # Tapered cupped closed petal, pinched root and broad distal shoulder.
    radial = Vector((math.cos(angle), math.sin(angle), 0))
    lateral = Vector((-math.sin(angle), math.cos(angle), 0))
    verts, faces, rows = [tuple(Vector(center))], [], [[0]]
    for i in range(1, 8):
        t = i / 8
        row = []
        for j in range(8):
            a = TAU * j / 8
            p = Vector(center) + radial * (length * t) + lateral * (width * math.sin(math.pi * t) ** .55 * math.cos(a))
            p.z += .012 * math.sin(math.pi * t) * math.sin(a) + .010 * t * t
            row.append(len(verts))
            verts.append(tuple(p))
        rows.append(row)
    rows.append([len(verts)])
    verts.append(tuple(Vector(center) + radial * length + Vector((0, 0, .010))))
    for a, b in zip(rows, rows[1:]):
        for j in range(8):
            k = (j + 1) % 8
            faces.append((a[0], b[j], b[k]) if len(a) == 1 else
                         (a[j], b[0], a[k]) if len(b) == 1 else (a[j], b[j], b[k], a[k]))
    return mesh(part, name, verts, faces, color)


def hoop():
    part = 'flower-hoop'
    torus(part, 'continuous-hoop', (0, .68, 0), .58, .58, .055, '#bb9a63', vertical=True, n=48)
    for i, (x, y) in enumerate(((-.4, 1.07), (0, 1.218), (.4, 1.07))):
        for j in range(5):
            petal(part, f'flower-{i}-petal-{j}', (x, y, .035), TAU * j / 5 + math.pi / 2,
                  .088,.037,'#e6a394' if j%2 else '#f2c4b3')
        ellipsoid(part, f'flower-{i}-pollen-cushion', (x,y,.044),(.035,.035,.021), '#f1d68c', n=12, rings=6)
        petal(part, f'flower-{i}-leaf', (x,y-.012,.033), -.6 if i % 2 else 3.7, .115,.030,'#84a184')


def bowl(part, water=False):
    lathe(part, 'hollow-vessel-rolled-rim',
          profile_curve([(0, .01), (.425, .01), (.463, .02), (.47, .045), (.455, .09),
           (.418, .226), (.421, .248), (.412, .266), (.398, .2725),
           (.383, .268), (.373, .253), (.375, .23), (.349, .105),
           (.322, .071), (.27, .055), (0, .055)]),
          lambda p: tint_mix(TEAL, CREAM, .65*smoothstep(.23,.266,p[1]) +
              .70*(1-smoothstep(.34,.39,math.hypot(p[0],p[2])))), 'satin', n=40)
    torus(part, 'recessed-foot-band', (0, .044, 0), .468, .468, .002,'#597d73',role='satin',n=40,sides=5)
    if water:
        lathe(part, 'inset-water-meniscus', [(0, .177), (.357, .177), (.362, .184), (.354, .188), (0, .180)],
              '#9bc9cc','satin',n=40)
        for i, r in enumerate((.115, .215)):
            tube(part, f'water-ripple-{i}', [(r * math.cos(a), .187, r * math.sin(a))
                 for a in [j * math.pi / 24 for j in range(15)]], .002, '#c7e9e6', 'satin', sides=5)


def flag_wave(x, y):
    return .025*math.sin(2*math.pi*x/.54) + .006*x/.54*math.sin(8*(y-.85))


def flag():
    part = 'paw-flag'
    lathe(part, 'pole-and-rounded-finial', [(0, 0), (.035, 0), (.027,1.315),(.024,1.344), (0, 1.36)], WOOD, n=16)
    nx, ny = 18, 9
    verts, faces = [], []
    for side in (-1, 1):
        for j in range(ny + 1):
            for i in range(nx + 1):
                x = .015+.525*i/nx-.012*math.sin(math.pi*j/ny)*(i/nx)**2
                y = .875+.39*j/ny-.030*math.sin(math.pi*i/nx)*(.65+.35*math.cos(math.pi*j/ny))
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
         lambda p: tint_mix('#8da992',CREAM,smoothstep(1.17,1.23,p[1])), 'fabric')
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


def handle_loft(part):
    rows=[(-.215,.038,.034),(-.29,.045,.041),(-.40,.059,.052),(-.50,.063,.065),
          (-.58,.052,.047),(-.625,.030,.029),(-.65,0,0)]
    verts, rings, faces, n=[],[],[],16
    for z,rx,ry in rows:
        if rx==0:
            rings.append([len(verts)]);verts.append((0,.03,z));continue
        rings.append(list(range(len(verts),len(verts)+n)))
        for j in range(n):
            a=TAU*j/n
            verts.append((rx*math.cos(a),.03+ry*math.sin(a),z))
    faces.append(tuple(reversed(rings[0])))
    for a,b in zip(rings,rings[1:]):
        for j in range(n):
            k=(j+1)%n
            faces.append((a[j],a[k],b[0]) if len(b)==1 else (a[j],a[k],b[k],b[j]))
    return mesh(part,'single-continuous-comfort-handle',verts,faces,'#b98b60')


def brush():
    part='grooming-brush'
    lathe(part,'rounded-brush-base-038-014-052',
          [(0,-.07),(.14,-.07),(.18,-.06),(.19,-.025),(.19,.025),(.18,.06),(.14,.07),(0,.07)],
          lambda p:tint_mix('#ae8055','#c99b70',.4+.18*math.sin(p[2]*11+p[0]*8)),n=32,sz=.26/.19)
    lathe(part,'oval-inset-bristle-cushion',[(0,-.082),(.14,-.082),(.16,-.076),(.15,-.063),(0,-.063)],
          '#738d82','fabric',n=32,sz=.224/.16)
    handle_loft(part)
    for i in range(24):
        row,column=i//4,i%4
        x=(-.115+column*(.23/3))*(.85 if row in (0,5) else 1.)
        z=-.165+row*.066
        tip=(x+.004*(1 if x>0 else -1),-.201,z+.003)
        tube(part,f'bristle-shaft-{i:02}',[(x,-.075,z),(x,-.14,z),tip],
             lambda t:.0085-.002*t,'#e9d8ba',sides=6)
        ellipsoid(part,f'rounded-bristle-tip-{i:02}',tip,(.008,.009,.008),CREAM,n=8,rings=4)


def food():
    part='dog-food'
    for i in range(9):
        center=(math.cos(i*2.4)*.25,i%2*.04,math.sin(i*2.4)*.25)
        lathe(part,f'scored-kibble-{i:02}',
              [(0,-.055),(.045,-.055),(.064,-.038),(.07,-.012),(.07,.012),(.064,.038),(.045,.055),(0,.055)],
              lambda p,c=center,i=i:tint_mix('#9b6a3d' if i%2 else '#a87543','#c79459',
                  smoothstep(c[1]-.025,c[1]+.04,p[1])*.62),n=16,center=center)


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
