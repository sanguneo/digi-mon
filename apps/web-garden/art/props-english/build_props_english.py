"""Complete English prop library. Blender 5.2.1, no images or rendering.

blender --background --factory-startup --python-exit-code 1 --python build_props_english.py
Geometry is authored Y-up, baked to Blender Z-up, and exported Y-up.
Every object has identity transforms; each part is one independently usable mesh.
"""
from pathlib import Path
import json
import math
import runpy
import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
WEB = HERE.parent.parent
GLB = WEB / 'public/models/props-english.glb'
BASELINE = json.loads((HERE / 'baseline-bounds.json').read_text())['bounds']
TAU = math.tau


def linear(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values) + (1,)


class Shape:
    def __init__(self):
        self.vertices, self.faces, self.colors, self.features = [], [], [], []

    def vertex(self, xyz, color):
        self.vertices.append(tuple(xyz))
        self.colors.append(linear(color) if isinstance(color, str) else color)
        return len(self.vertices) - 1

    def face(self, *indices):
        self.faces.append(tuple(indices))

    def feature(self, kind, **data):
        self.features.append({'kind': kind, **data})

    def fit(self, name):
        """Bake historic extents into vertices; retain the application origin."""
        low = [min(v[a] for v in self.vertices) for a in range(3)]
        high = [max(v[a] for v in self.vertices) for a in range(3)]
        ref = BASELINE[name]
        self.vertices = [tuple(ref['min'][a] + (v[a] - low[a]) *
                               (ref['max'][a] - ref['min'][a]) / (high[a] - low[a])
                               for a in range(3)) for v in self.vertices]

    def sphere(self, center, radii, color, segments=16, rings=10, irregular: float = 0):
        def point(theta, phi):
            ripple = 1 + irregular * (.6 * math.sin(theta * 3 + phi * 2) + .4 * math.cos(theta * 5 - phi))
            return (center[0] + radii[0] * math.sin(phi) * math.cos(theta) * ripple,
                    center[1] + radii[1] * math.cos(phi) * ripple,
                    center[2] + radii[2] * math.sin(phi) * math.sin(theta) * ripple)
        top = self.vertex(point(0, 0), color)
        rows = [[self.vertex(point(i * TAU / segments, j * math.pi / rings), color)
                 for i in range(segments)] for j in range(1, rings)]
        bottom = self.vertex(point(0, math.pi), color)
        for i in range(segments):
            k = (i + 1) % segments
            self.face(top, rows[0][i], rows[0][k])
            for a, b in zip(rows, rows[1:]):
                self.face(a[i], b[i], b[k], a[k])
            self.face(rows[-1][i], bottom, rows[-1][k])

    def tube(self, points, radii, color, sides=8):
        rows = []
        points = [Vector(p) for p in points]
        u = None
        for j, p in enumerate(points):
            tangent = (points[min(j + 1, len(points) - 1)] - points[max(j - 1, 0)]).normalized()
            if u is None:
                guide = Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((1, 0, 0))
                u = tangent.cross(guide).normalized()
            else:
                # Transport the previous frame; never switch axes mid-curve.
                u = (u - tangent * u.dot(tangent)).normalized()
            v = tangent.cross(u).normalized()
            rows.append([self.vertex(p + radii[j] * (u * math.cos(i * TAU / sides) +
                                                    v * math.sin(i * TAU / sides)), color)
                         for i in range(sides)])
        self.face(*reversed(rows[0]))
        for a, b in zip(rows, rows[1:]):
            for i in range(sides):
                k = (i + 1) % sides
                self.face(a[i], a[k], b[k], b[i])
        self.face(*rows[-1])

    def torus(self, center, radius, tube, color, segments=32, sides=10):
        rows = []
        for i in range(segments):
            a = i * TAU / segments
            rows.append([self.vertex((center[0] + (radius + tube * math.cos(j * TAU / sides)) * math.cos(a),
                                      center[1] + (radius + tube * math.cos(j * TAU / sides)) * math.sin(a),
                                      center[2] + tube * math.sin(j * TAU / sides)), color)
                         for j in range(sides)])
        for i in range(segments):
            a, b = rows[i], rows[(i + 1) % segments]
            for j in range(sides):
                k = (j + 1) % sides
                self.face(a[j], a[k], b[k], b[j])

    def bevel_box(self, center, size, color, bevel=.018):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        for vert in bm.verts:
            vert.co = Vector(tuple(vert.co[a] * size[a] for a in range(3)))
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES')
        ids = {v: self.vertex(tuple(v.co[a] + center[a] for a in range(3)), color) for v in bm.verts}
        for face in bm.faces:
            self.face(*(ids[v] for v in face.verts))
        bm.free()


def shell():
    s = Shape()
    # Thick scallop fan: sculpted ribs on both surfaces and a scalloped edge.
    steps, rings = 56, 7
    layers = []
    for back in (False, True):
        tip = s.vertex((0, .075, -.07 if back else .045), '#e2ac9c' if back else '#f9debf')
        rows = []
        for j in range(1, rings + 1):
            t = j / rings
            row = []
            for i in range(steps + 1):
                a = i * math.pi / steps
                flute = .5 + .5 * math.cos(a * 18)
                scallop = 1 - .038 * (1 - flute) * t ** 3
                x = .68 * math.cos(a) * t * scallop
                y = .075 + .825 * math.sin(a) * t * scallop
                z = (-.11 - .065 * math.sin(t * math.pi) - .012 * flute * t) if back else (
                    .015 + .10 * math.sin(t * math.pi * .85) + .043 * flute * t)
                color = '#efc0a9' if back else ('#fff0dc' if flute > .55 else '#edc1ac')
                row.append(s.vertex((x, y, z), color))
            rows.append(row)
        for i in range(steps):
            s.face(tip, rows[0][i], rows[0][i + 1])
        for a, b in zip(rows, rows[1:]):
            for i in range(steps):
                s.face(a[i], b[i], b[i + 1], a[i + 1])
        layers.append((tip, rows))
    front, back = layers
    for i in range(steps):
        s.face(front[1][-1][i], back[1][-1][i], back[1][-1][i + 1], front[1][-1][i + 1])
    for edge in (0, steps):
        a = [front[0]] + [r[edge] for r in front[1]]
        b = [back[0]] + [r[edge] for r in back[1]]
        for j in range(rings):
            s.face(a[j], b[j], b[j + 1], a[j + 1])
    s.sphere((0, .15, .24), (.14, .14, .14), '#fff2d6', 20, 12)
    s.feature('thick-fluted-scallop', ribs=9, radial_rings=rings)
    s.feature('pearl', count=1)
    return s


def kelp():
    s = Shape()
    for blade, (base, lean, height) in enumerate([(-.24, -.34, .86), (-.13, -.10, 1.08),
                                                (0, .10, 1.2), (.15, .40, .96), (.24, .12, .74)]):
        rows = []
        for j in range(17):
            t = j / 16
            x = base + lean * t + .065 * math.sin(t * TAU + blade * .65) * math.sin(t * math.pi)
            y = height * t
            z = .052 * math.sin(t * TAU + blade) * math.sin(t * math.pi)
            width = .015 + .074 * math.sin(math.pi * t) ** .65
            twist = .75 * math.sin(t * math.pi * 1.5 + blade * .7)
            row = []
            for side, depth in ((-1, -.012), (1, -.012), (1, .012), (-1, .012)):
                row.append(s.vertex((x + side * width * math.cos(twist), y,
                                     z + side * width * math.sin(twist) + depth),
                                    '#398c80' if depth < 0 else ('#64af98' if side < 0 else '#88c1a3')))
            rows.append(row)
        s.face(*reversed(rows[0]))
        for a, b in zip(rows, rows[1:]):
            for k in range(4):
                n = (k + 1) % 4
                s.face(a[k], b[k], b[n], a[n])
        s.face(*rows[-1])
        s.feature('solid-curved-ribbon', blade=blade, longitudinal_sections=16)
    s.sphere((0, .025, 0), (.3, .04, .08), '#477e73', 12, 6, .06)
    return s


def coral():
    s = Shape()
    s.sphere((0, -.07, 0), (.40, .06, .11), '#c58e92', 16, 6, .13)
    for i, (x, height, lean) in enumerate([(-.29, .64, -.13), (0, .85, .035), (.28, .70, .12)]):
        color = ['#e79f94', '#edb1a1', '#d98e93'][i]
        points = [(x + lean * (j / 8) ** 1.3, -.09 + height * j / 8,
                   .014 * math.sin(j * .65 + i)) for j in range(9)]
        s.tube(points, [.068 - .040 * j / 8 for j in range(9)], color, 9)
        s.sphere(points[-1], (.029, .035, .029), '#f5c8af', 10, 6)
        for branch, (level, direction) in enumerate(((.35, -1), (.52, 1), (.69, -1))):
            start = (x + lean * level ** 1.3, -.09 + height * level, 0)
            reach = (.17 if branch < 2 else .12) * direction
            points = [(start[0] + reach * math.sin(t * math.pi / 2),
                       start[1] + .20 * t + .055 * t * t, .025 * math.sin(t * math.pi + i))
                      for t in (0, .2, .4, .6, .8, 1)]
            s.tube(points, [.040, .038, .034, .029, .022, .017], color, 8)
            s.sphere(points[-1], (.022, .027, .023), '#f4c0a7', 8, 6)
        s.feature('branching-coral', stalk=i, side_branches=3)
    return s


def bubble_rock():
    s = Shape()
    s.sphere((0, .20, 0), (.5, .27, .38), '#91afb0', 20, 10, .12)
    s.sphere((-.25, .12, .20), (.18, .13, .13), '#b3c7bf', 12, 6, .1)
    s.sphere((.21, .25, .20), (.21, .15, .13), '#a2beba', 12, 6, .08)
    for i in range(4):
        center = (math.sin(i) * .15, .5 + i * .3, 0)
        s.sphere(center, (.09, .09, .09), '#bce5df', 16, 10)
        s.sphere((center[0] - .027, center[1] + .035, .078), (.025, .029, .008), '#effff0', 8, 6)
    s.feature('irregular-rock', surface_ripple=.12)
    s.feature('opaque-bubble-forms', count=4, highlight_relief=True)
    return s


def chest():
    s = Shape()
    # Open trough, inset floor, and four-sided interior lip expose real depth.
    s.bevel_box((0, .055, 0), (.73, .09, .49), '#8d6448')
    s.bevel_box((0, .25, .22), (.73, .39, .055), '#ad7c51')
    s.bevel_box((0, .25, -.22), (.73, .39, .055), '#9b704d')
    for x in (-.34, .34):
        s.bevel_box((x, .25, 0), (.065, .39, .44), '#a8764e')
    s.bevel_box((0, .11, 0), (.60, .025, .36), '#614f42', .007)
    for z in (-.19, .19):
        s.bevel_box((0, .445, z), (.65, .025, .036), '#d3aa6a', .008)
    for x in (-.31, .31):
        s.bevel_box((x, .445, 0), (.035, .025, .38), '#d3aa6a', .008)
    # Barrel lid with inset end rings forming bevels, opened about the back hinge.
    angle = math.radians(23)

    def lid_point(x, a, inset: float = 0):
        z = (.22 - inset) * math.cos(a)
        y = .465 + (.21 - inset) * math.sin(a)
        dy, dz = y - .465, z + .22
        return (x, .465 + dy * math.cos(angle) + dz * math.sin(angle),
                -.22 - dy * math.sin(angle) + dz * math.cos(angle))

    rows = []
    for x, inset in ((-.36, .016), (-.343, 0), (.343, 0), (.36, .016)):
        rows.append([s.vertex(lid_point(x, j * math.pi / 16, inset),
                              '#bc8e5e' if j % 4 else '#9c704e') for j in range(17)])
    for a, b in zip(rows, rows[1:]):
        for j in range(16):
            s.face(a[j], b[j], b[j + 1], a[j + 1])
        s.face(a[-1], b[-1], b[0], a[0])
    s.face(*reversed(rows[0]))
    s.face(*rows[-1])
    # Bronze bands follow the lid curvature and continue down both body faces.
    for x in (-.235, .235):
        s.tube([lid_point(x, j * math.pi / 20, -.009) for j in range(21)], [.018] * 21, '#dfbc74', 6)
        s.bevel_box((x, .245, .253), (.048, .38, .018), '#d8b16b', .006)
        s.bevel_box((x, .245, -.253), (.048, .38, .018), '#c6a165', .006)
    s.bevel_box((0, .30, .272), (.10, .14, .045), '#f2d380', .012)
    s.bevel_box((0, .31, .296), (.018, .041, .008), '#695644', .003)
    for x in (-.23, .23):
        for y in (.11, .39):
            s.sphere((x, y, .27), (.012, .012, .009), '#f6d890', 8, 4)
    s.feature('curved-beveled-barrel-lid', open_angle_degrees=23, profile_sections=16)
    s.feature('hollow-interior', lip_sides=4, curved_bands=2)
    return s


def star():
    s = Shape()
    segments, rings = 60, 5
    surfaces = []
    for back in (False, True):
        center = s.vertex((0, .37, -.075 if back else .082), '#d6aa67' if back else '#ffe4a4')
        rows = []
        for j in range(1, rings + 1):
            t = j / rings
            row = []
            for i in range(segments):
                a = math.pi / 2 + i * TAU / segments
                # Continuous rounded five-lobe outline, not intersecting ovals.
                radius = .295 + .145 * math.cos(5 * (a - math.pi / 2))
                z = -.035 - .04 * (1 - t * t) if back else .025 + .060 * (1 - t * t)
                row.append(s.vertex((radius * t * math.cos(a), .37 + radius * t * math.sin(a), z),
                                    '#d9b171' if back else ('#f4cc81' if j == rings else '#f8d993')))
            rows.append(row)
        for i in range(segments):
            k = (i + 1) % segments
            s.face(center, rows[0][i], rows[0][k])
        for a, b in zip(rows, rows[1:]):
            for i in range(segments):
                k = (i + 1) % segments
                s.face(a[i], b[i], b[k], a[k])
        surfaces.append(rows[-1])
    a, b = surfaces
    for i in range(segments):
        k = (i + 1) % segments
        s.face(a[i], b[i], b[k], a[k])
    for i in range(5):
        angle = math.pi / 2 + i * TAU / 5
        for j in range(3):
            r = .10 + j * .093
            z = .025 + .06 * (1 - (r / .44) ** 2)
            s.sphere((r * math.cos(angle), .37 + r * math.sin(angle), z),
                     (.018 - j * .002, .018 - j * .002, .012), '#fff0bc', 8, 6)
    s.sphere((0, .37, .086), (.030, .030, .012), '#ffe9ad', 12, 6)
    s.feature('continuous-thick-starfish', lobes=5, relief_nodules=16)
    return s


def food():
    s = Shape()
    for i in range(5):
        center = ((i % 2 - .5) * .11, i * .085, 0)
        s.sphere(center, (.055,) * 3, '#a47248' if i % 2 else '#9b643c', 12, 8)
        s.feature('pellet', center=list(center), radius=.055)
    return s


def trail():
    s = Shape()
    for i in range(5):
        center = (math.sin(i * 1.6) * .3, i * .3, 0)
        radius = .12 + i % 2 * .07
        # Opaque open rings retain the deliberately shallow care silhouette.
        # Ten tube sides preserve the baseline's exact minimum Z extent.
        s.torus(center, radius, .014, '#c6f3ed', 24, 10)
        s.sphere((center[0] - .055, center[1] + .07, .02), (.026, .04, .02), '#e5fff4', 12, 8)
        s.feature('bubble-ring', center=list(center), major_radius=radius, tube_radius=.014)
    return s


def make_material(name, roughness):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (1, 1, 1, 1)
    material.use_backface_culling = True
    principled = material.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (1, 1, 1, 1)
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Metallic'].default_value = 0
    principled.inputs['Alpha'].default_value = 1
    colors = material.node_tree.nodes.new('ShaderNodeVertexColor')
    colors.layer_name = 'Color'
    material.node_tree.links.new(colors.outputs['Color'], principled.inputs['Base Color'])
    return material


def make_object(name, shape, material, root):
    mesh = bpy.data.meshes.new(name + '-geometry')
    mesh.from_pydata([(x, -z, y) for x, y, z in shape.vertices], [], shape.faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    # Triangulate before UV projection so curved quads cannot collapse in UV.
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    color = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    for datum, rgba in zip(color.data, shape.colors):
        datum.color = rgba
    mesh.color_attributes.active_color = color
    mesh.materials.append(material)
    # Deterministic tri-planar UVs. Overlaps intentional for texture-free colors.
    uv = mesh.uv_layers.new(name='UVMap')
    low = [min(v.co[a] for v in mesh.vertices) for a in range(3)]
    high = [max(v.co[a] for v in mesh.vertices) for a in range(3)]
    for face in mesh.polygons:
        face.use_smooth = True
        dominant = max(range(3), key=lambda a: abs(face.normal[a]))
        axes = [a for a in range(3) if a != dominant]
        for loop in face.loop_indices:
            p = mesh.vertices[mesh.loops[loop].vertex_index].co
            uv.data[loop].uv = tuple((p[a] - low[a]) / (high[a] - low[a]) for a in axes)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    obj['geometry_features'] = json.dumps(shape.features)
    obj['coordinates'] = 'Y-up export; identity local transform; historic origin retained'
    return obj


def main():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Remove factory-startup orphans too, including empty Render Result/Viewer
    # image datablocks. Neither the editable library nor GLB needs them.
    for blocks in (bpy.data.materials, bpy.data.meshes, bpy.data.cameras,
                   bpy.data.lights, bpy.data.images, bpy.data.actions):
        for block in list(blocks):
            blocks.remove(block)
    roles = {'matte': make_material('english-matte', .82),
             'satin': make_material('english-satin', .34),
             'wood': make_material('english-wood', .68)}
    root = bpy.data.objects.new('english-props', None)
    bpy.context.collection.objects.link(root)
    root['library'] = 'Eight independently cloneable identity-local parts; no layout offsets'
    builders = [('shell-arch', shell, 'satin'), ('ribbon-kelp', kelp, 'matte'),
                ('coral-garden', coral, 'matte'), ('bubble-rock', bubble_rock, 'satin'),
                ('treasure-chest', chest, 'wood'), ('star-lamp', star, 'matte'),
                ('fish-food', food, 'wood'), ('bubble-trail', trail, 'satin')]
    features = {}
    for name, builder, role in builders:
        shape = builder()
        if name not in ('fish-food', 'bubble-trail'):
            shape.fit(name)
        make_object(name, shape, roles[role], root)
        features[name] = shape.features
    bpy.context.view_layer.objects.active = bpy.data.objects['shell-arch']
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'props-english.blend'))
    GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB',
                              export_yup=True, export_apply=True, export_animations=False,
                              export_cameras=False, export_lights=False,
                              export_texcoords=True, export_normals=True,
                              export_vertex_color='NAME', export_vertex_color_name='Color',
                              export_all_vertex_colors=False,
                              export_tangents=False, export_materials='EXPORT',
                              export_attributes=False, export_extras=False,
                              export_image_format='NONE')
    validate = runpy.run_path(str(HERE / 'validate_props_english.py'))['validate']
    report = validate(GLB, HERE / 'baseline-bounds.json')
    report['blender_version'] = bpy.app.version_string
    report['source_geometry_features'] = features
    report['blend_bytes'] = (HERE / 'props-english.blend').stat().st_size
    (HERE / 'validation-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'triangles': report['triangles'],
                      'glb_bytes': report['glb_bytes'], 'parts': len(report['parts'])}))


if __name__ == '__main__':
    main()
