"""Staging baby fish v2; default output is staging only. No image, render or preview operations.

Build: Blender --background --factory-startup --python apps/web-garden/art/fish-v2/build_fish_v2.py
Verify: python apps/web-garden/art/fish-v2/build_fish_v2.py --verify-only
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

HERE = Path(__file__).resolve().parent
glb_path = HERE / 'fish-v2.glb'
BLEND = HERE / 'fish-v2.blend'
REPORT = HERE / 'asset-report.json'
COMMAND = '"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python apps/web-garden/art/fish-v2/build_fish_v2.py'
PIVOTS = {'body': (0, 0, 0), 'tail': (-.65, 0, 0),
          'pectoral-fin': (0, -.13, .28), 'mouth': (.68, -.05, 0),
          'growth-markings': (0, 0, 0), 'growth-fin-detail': (0, 0, 0)}
CORAL, CREAM, FIN, INK, WHITE = '#f28b7d', '#ffe8c5', '#f6b4a0', '#292b30', '#ffffff'

def rgb(text):
    channels = [int(text[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels)


def mix(a, b, t):
    return tuple(x * (1-t) + y * t for x, y in zip(a, b))


def add(a, b):
    return tuple(x+y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def mul(a, s):
    return tuple(x*s for x in a)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def length(a):
    return math.sqrt(dot(a, a))


def unit(a):
    return mul(a, 1/length(a))


def P(v):
    # Final Y-up geometry is stored Z-up in Blender; exporter inverts this map.
    return (v[0], -v[2], v[1])


def profile(x):
    """Continuous asymmetric egg with a baked five-degree rising centerline."""
    u = (x + .76) / 1.52
    radius = math.sqrt(max(0, 1 - (2*u-1)**2)) * (.55 + .50*u)
    return .035 + math.tan(math.radians(5))*x, .535*radius, .445*radius


def side_surface(x, y, side):
    cy, ry, rz = profile(x)
    return (x, y, side*rz*math.sqrt(max(0, 1-((y-cy)/ry)**2)))


def front_surface(y, z):
    lo, hi = .3, .76
    for _ in range(50):
        x = (lo+hi)/2
        cy, ry, rz = profile(x)
        if ((y-cy)/ry)**2 + (z/rz)**2 < 1:
            lo = x
        else:
            hi = x
    return (lo, y, z)


class Geometry:
    def __init__(self, name):
        self.name = name
        self.vertices, self.faces, self.colors, self.parts = [], [], [], []

    def vertex(self, p, color):
        self.vertices.append(p)
        self.colors.append(rgb(color) if isinstance(color, str) else color)
        return len(self.vertices)-1

    def part(self, name, start):
        self.parts.append({'name': name, 'first_vertex': start,
                           'vertices': len(self.vertices)-start})

    def sphere(self, name, surface, color, rings=24, segments=48):
        """Closed sphere topology with shared poles and no collapsed quads."""
        start, rows = len(self.vertices), []
        def vert(phi, theta):
            p = surface(phi, theta)
            return self.vertex(p, color(p) if callable(color) else color)
        first = vert(0, 0)
        for i in range(1, rings):
            rows.append([vert(math.pi*i/rings, 2*math.pi*j/segments) for j in range(segments)])
        last = vert(math.pi, 0)
        for j in range(segments):
            k = (j+1) % segments
            self.faces.append((first, rows[0][j], rows[0][k]))
            self.faces.append((last, rows[-1][k], rows[-1][j]))
        for row, nxt in zip(rows, rows[1:]):
            for j in range(segments):
                k = (j+1) % segments
                self.faces.append((row[j], nxt[j], nxt[k], row[k]))
        self.part(name, start)

    def ellipsoid(self, name, center, radii, color, rings=12, segments=24):
        self.sphere(name, lambda p, a: add(center, (radii[0]*math.sin(p)*math.cos(a),
                    radii[1]*math.sin(p)*math.sin(a), radii[2]*math.cos(p))), color, rings, segments)

    def shell(self, name, contour, center, thickness, color=FIN, transform=lambda p: p):
        """Inflate a smooth star-shaped outline into a closed lenticular solid."""
        n = len(contour)
        def outline(angle):
            f = angle/(2*math.pi)*n
            i, t = int(f) % n, f % 1
            a, b, c, d = [contour[(i+k) % n] for k in (-1, 0, 1, 2)]
            return tuple(.5*((2*b[k])+(-a[k]+c[k])*t +
                (2*a[k]-5*b[k]+4*c[k]-d[k])*t*t +
                (-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in range(2))
        def surface(phi, angle):
            x, y = outline(angle)
            r = math.sin(phi)
            return transform((center[0]+(x-center[0])*r,
                              center[1]+(y-center[1])*r, thickness*math.cos(phi)))
        self.sphere(name, surface, color, 20, n*6)

    def object(self, parent, material):
        import bpy
        import bmesh
        pivot = PIVOTS[self.name]
        data = bpy.data.meshes.new(self.name+'-editable-mesh')
        data.from_pydata([P(sub(v, pivot)) for v in self.vertices], [], self.faces)
        data.update()
        bm = bmesh.new()
        bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(data)
        bm.free()
        data.materials.append(material)
        colors = data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
        for i, c in enumerate(self.colors):
            colors.data[i].color = (*c, 1)
        data.color_attributes.active_color = colors
        data.color_attributes.render_color_index = 0
        for face in data.polygons:
            face.use_smooth = True
        obj = bpy.data.objects.new(self.name, data)
        bpy.context.collection.objects.link(obj)
        obj.parent, obj.location = parent, P(pivot)
        obj['anatomical_parts'] = json.dumps(self.parts)
        if self.name.startswith('growth-'):
            obj['visible_from_stage'] = 2 if self.name == 'growth-markings' else 3
        # Real chart UVs, including caps, with corner seams retained on export.
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.015)
        bpy.ops.object.mode_set(mode='OBJECT')
        return obj


def eye(body, side):
    x0, y0, rx, ry = .405, .19, .121, .133
    def eye_surface(phi, angle):
        x, y = x0+rx*math.sin(phi)*math.cos(angle), y0+ry*math.sin(phi)*math.sin(angle)
        return add(side_surface(x, y, side), (0, 0, side*(.007+.053*math.cos(phi))))
    body.sphere('large-solid-dark-eye-'+str(side), eye_surface, INK, 20, 40)
    # Ordinary white flattened dot, not a ring, sclera or emissive shader.
    x, y = x0+.026, y0+.044
    def highlight_surface(phi, angle):
        xx, yy = x+.022*math.sin(phi)*math.cos(angle), y+.025*math.sin(phi)*math.sin(angle)
        r2 = ((xx-x0)/rx)**2+((yy-y0)/ry)**2
        z = side_surface(xx, yy, side)[2]+side*(.007+.053*math.sqrt(1-r2)+.002+.003*math.cos(phi))
        return (xx, yy, z)
    body.sphere('single-white-eye-highlight-'+str(side), highlight_surface, WHITE, 10, 24)


def make_geometry():
    body = Geometry('body')
    def body_surface(phi, angle):
        x = -.76*math.cos(phi)
        cy, ry, rz = profile(x)
        return (x, cy+ry*math.cos(angle), rz*math.sin(angle))
    def body_color(p):
        # Broad coral/cream color roles, no baked light, stripes or noise.
        x, y, _ = p
        threshold = -.06 + .18*max(0, (x+.1)/.86)
        t = max(0, min(1, (threshold-y)/.065+.5))
        return mix(rgb(CORAL), rgb(CREAM), t*t*(3-2*t))
    body.sphere('continuous-chubby-teardrop-body', body_surface, body_color, 64, 64)
    dorsal = [(-.40, .35), (-.30, .54), (-.11, .72), (.015, .72),
              (.055, .58), (.26, .47), (.10, .41), (-.17, .39)]
    body.shell('rounded-triangle-dorsal', dorsal, (-.09, .51), .033)
    pectoral = [(.025, -.13), (.115, -.22), (.09, -.38), (-.005, -.46),
                (-.09, -.42), (-.12, -.28), (-.06, -.15)]
    def fin_position(p, opposite=False):
        x, y, z = p
        z += .315 + .12*max(0, (-y-.13)/.33)
        if opposite:
            x, y = (x*math.cos(-.6)-(y+.13)*math.sin(-.6),
                    x*math.sin(-.6)+(y+.13)*math.cos(-.6)-.13)
            z = -z
        return (x, y, z)
    body.shell('opposite-rounded-pectoral', pectoral, (0, -.29), .024,
               transform=lambda p: fin_position(p, True))
    for side in (-1, 1):
        eye(body, side)
    tail = Geometry('tail')
    tail.shell('single-rounded-crescent-tail',
        [(-.64, 0), (-.80, .14), (-1.10, .46), (-1.245, .49),
         (-1.29, .39), (-1.12, .12), (-1.08, 0), (-1.12, -.12),
         (-1.29, -.39), (-1.245, -.49), (-1.10, -.46), (-.80, -.14)],
        (-.96, 0), .038)
    fin = Geometry('pectoral-fin')
    fin.shell('animated-rounded-pectoral', pectoral, (0, -.29), .024, transform=fin_position)
    mouth = Geometry('mouth')
    # One closed thin crescent on the face; no annular lips or snout.
    # Independent local-Y stretching opens it during the feeding response.
    def mouth_surface(phi, angle):
        t = math.cos(phi)
        z = .147*t
        y = -.067+.069*t*t + .013*math.sin(phi)*math.cos(angle)
        x = front_surface(y, z)[0] + .008 + .007*math.sin(phi)*math.sin(angle)
        return (x, y, z)
    mouth.sphere('surface-following-upturned-smile', mouth_surface, INK, 32, 12)
    markings = Geometry('growth-markings')
    for side in (-1, 1):
        for x, y, r in [(-.34, .115, .040), (-.15, .225, .043), (-.13, -.015, .033)]:
            def spot_surface(phi, angle, x=x, y=y, r=r, side=side):
                xx, yy = x+r*math.sin(phi)*math.cos(angle), y+r*math.sin(phi)*math.sin(angle)
                return add(side_surface(xx, yy, side), (0, 0, side*(.004+.008*math.cos(phi))))
            markings.sphere('soft-cream-growth-spot-'+str(side), spot_surface, CREAM, 10, 20)
    detail = Geometry('growth-fin-detail')
    # Broad low dorsal scallops, never radial fan ridges or stripe geometry.
    for x, y, rx in [(-.22, .638, .052), (-.105, .726, .061), (.002, .710, .048)]:
        detail.ellipsoid('rounded-mature-dorsal-accent', (x, y, 0), (rx, .053, .034), CREAM, 12, 24)
    return [body, tail, fin, mouth, markings, detail]


def build():
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.file_preview_type = 'NONE'
    mat = bpy.data.materials.new('coral-cream-matte-vertex-color')
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
    shader.inputs['Roughness'].default_value = .82
    shader.inputs['Metallic'].default_value = 0
    vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'Color'
    mat.node_tree.links.new(vertex.outputs['Color'], shader.inputs['Base Color'])
    root = bpy.data.objects.new('fish-asset', None)
    bpy.context.collection.objects.link(root)
    root['forward_axis'], root['final_up_axis'] = '+X', '+Y'
    root['blender_version'] = bpy.app.version_string
    root['original_design'] = 'Baby peachdrop v2: round teardrop, dark side eyes, crescent smile and solid crescent tail'
    for geometry in make_geometry():
        geometry.object(root, mat)
    bpy.context.scene['authoring_policy'] = 'Geometry only; no preview, render, image or screenshot operations'
    assert len(bpy.data.images) == 0
    bpy.ops.object.select_all(action='SELECT')
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format='GLB', use_selection=True,
        export_yup=True, export_apply=True, export_texcoords=True, export_normals=True,
        export_materials='EXPORT', export_animations=False, export_cameras=False,
        export_lights=False, export_extras=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), compress=True)
    return bpy.app.version_string


def bounds(points):
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    return {'min': low, 'max': high, 'dimensions': sub(high, low), 'center': mul(add(low, high), .5)}


def topology(positions, indices):
    # Weld exporter UV/normal splits by position, not arbitrary proximity.
    unique, remap, points = {}, [], []
    for p in positions:
        key = tuple(round(v, 7) for v in p)
        if key not in unique:
            unique[key] = len(points)
            points.append(p)
        remap.append(unique[key])
    adjacent = [set() for _ in points]
    edges = collections.Counter()
    degenerate, min_area, volume = 0, math.inf, 0
    for a, b, c in zip(indices[::3], indices[1::3], indices[2::3]):
        p, q, r = positions[a], positions[b], positions[c]
        area = length(cross(sub(q, p), sub(r, p)))*.5
        min_area = min(min_area, area)
        degenerate += area < 1e-12
        volume += dot(p, cross(q, r))/6
        a, b, c = remap[a], remap[b], remap[c]
        for v, w in ((a, b), (b, c), (c, a)):
            adjacent[v].add(w)
            adjacent[w].add(v)
            edges[tuple(sorted((v, w)))] += 1
    unseen, components = set(range(len(points))), []
    while unseen:
        todo, found = [unseen.pop()], []
        while todo:
            v = todo.pop()
            found.append(v)
            fresh = adjacent[v] & unseen
            unseen.difference_update(fresh)
            todo.extend(fresh)
        members = set(found)
        component_edges = [n for (a, b), n in edges.items() if a in members and b in members]
        components.append({'vertices': len(found), 'bounds': bounds([points[v] for v in found]),
                           'boundary_edges': sum(n == 1 for n in component_edges),
                           'nonmanifold_edges': sum(n > 2 for n in component_edges)})
    return {'welded_vertices': len(points), 'components': sorted(components, key=lambda c: -c['vertices']),
            'degenerate_triangles': degenerate, 'minimum_triangle_area': min_area,
            'signed_volume': volume, 'boundary_edges': sum(n == 1 for n in edges.values()),
            'nonmanifold_edges': sum(n > 2 for n in edges.values())}


def verify(version=None):
    raw = glb_path.read_bytes()
    assert struct.unpack_from('<4sII', raw) == (b'glTF', 2, len(raw))
    chunks, offset = {}, 12
    while offset < len(raw):
        size, kind = struct.unpack_from('<II', raw, offset)
        assert size % 4 == 0 and offset+8+size <= len(raw)
        chunks[kind] = raw[offset+8:offset+8+size]
        offset += 8+size
    assert set(chunks) == {0x4E4F534A, 0x004E4942}
    doc, binary = json.loads(chunks[0x4E4F534A]), chunks[0x004E4942]
    assert len(doc['buffers']) == 1 and 'uri' not in doc['buffers'][0]
    assert all(not doc.get(key) for key in ('images', 'textures', 'cameras', 'animations', 'skins'))
    assert not doc.get('extensionsRequired')
    assert not doc.get('extensions', {}).get('KHR_lights_punctual')

    def values(index):
        accessor = doc['accessors'][index]
        view = doc['bufferViews'][accessor['bufferView']]
        assert view.get('buffer', 0) == 0 and not accessor.get('sparse')
        count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
        fmt, width = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}[accessor['componentType']]
        stride = view.get('byteStride', count*width)
        start = view.get('byteOffset', 0)+accessor.get('byteOffset', 0)
        assert start+(accessor['count']-1)*stride+count*width <= view.get('byteOffset', 0)+view['byteLength'] <= len(binary)
        rows = [struct.unpack_from('<'+fmt*count, binary, start+i*stride) for i in range(accessor['count'])]
        if accessor.get('normalized'):
            rows = [tuple(v/((1 << (width*8))-1) for v in row) for row in rows]
        assert all(math.isfinite(v) for row in rows for v in row)
        return rows

    def near(a, b):
        return len(a) == len(b) and all(abs(x-y) < 1e-6 for x, y in zip(a, b))

    nodes = {node['name']: node for node in doc['nodes']}
    assert set(nodes) == {'fish-asset', *PIVOTS}
    root_index = doc['nodes'].index(nodes['fish-asset'])
    assert doc['scenes'][doc.get('scene', 0)]['nodes'] == [root_index]
    assert set(nodes['fish-asset']['children']) == set(range(len(nodes)))-{root_index}
    for name, node in nodes.items():
        assert 'matrix' not in node
        assert near(node.get('rotation', (0, 0, 0, 1)), (0, 0, 0, 1))
        assert near(node.get('scale', (1, 1, 1)), (1, 1, 1))
        assert near(node.get('translation', (0, 0, 0)), PIVOTS.get(name, (0, 0, 0)))
    total_triangles, total_vertices, primitive_count = 0, 0, 0
    node_report, all_points, geometry_by_name = {}, [], {}
    for name, pivot in PIVOTS.items():
        node = nodes[name]
        primitives = doc['meshes'][node['mesh']]['primitives']
        assert len(primitives) == 1
        primitive = primitives[0]
        assert primitive.get('mode', 4) == 4 and not primitive.get('targets')
        attrs = primitive['attributes']
        assert {'POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'} <= attrs.keys()
        p, n, uv, colors = [values(attrs[key]) for key in ('POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0')]
        indices = [row[0] for row in values(primitive['indices'])]
        assert len(indices) % 3 == 0 and max(indices) < len(p)
        assert len(p) == len(n) == len(uv) == len(colors)
        assert all(abs(length(v)-1) < 2e-5 for v in n)
        assert all(0 <= c <= 1 for color in colors for c in color)
        assert all(len(color) == 3 or abs(color[3]-1) < 1e-6 for color in colors)
        uv_span = [max(v[i] for v in uv)-min(v[i] for v in uv) for i in range(2)]
        assert min(uv_span) > .5
        world = [add(v, pivot) for v in p]
        topo = topology(p, indices)
        assert topo['degenerate_triangles'] == 0, (name, topo['degenerate_triangles'])
        assert topo['nonmanifold_edges'] == 0, (name, topo['nonmanifold_edges'])
        assert topo['boundary_edges'] == 0, (name, topo['boundary_edges'])
        uv_areas = [abs((uv[b][0]-uv[a][0])*(uv[c][1]-uv[a][1]) - (uv[b][1]-uv[a][1])*(uv[c][0]-uv[a][0]))*.5
                    for a, b, c in zip(indices[::3], indices[1::3], indices[2::3])]
        assert min(uv_areas) > 1e-12, (name, min(uv_areas))
        triangles = len(indices)//3
        total_triangles += triangles
        total_vertices += len(p)
        primitive_count += 1
        all_points.extend(world)
        geometry_by_name[name] = world
        node_report[name] = {'pivot': node.get('translation', [0, 0, 0]),
            'rotation': node.get('rotation', [0, 0, 0, 1]), 'scale': node.get('scale', [1, 1, 1]),
            'vertices': len(p), 'triangles': triangles, 'primitives': 1,
            'attributes': sorted(attrs), 'local_bounds': bounds(p), 'world_bounds': bounds(world),
            'normal_length_range': [min(map(length, n)), max(map(length, n))],
            'uv_span': uv_span, 'minimum_uv_triangle_area': min(uv_areas), 'degenerate_uv_triangles': 0, 'linear_color_min': [min(c[i] for c in colors) for i in range(3)],
            'linear_color_max': [max(c[i] for c in colors) for i in range(3)], 'topology': topo}
    core = node_report['body']['topology']['components'][0]
    assert core['vertices'] == 63*64+2 and core['boundary_edges'] == core['nonmanifold_edges'] == 0
    assert near(core['bounds']['min'][0:1], [-.76]) and near(core['bounds']['max'][0:1], [.76])
    for name in ('tail', 'pectoral-fin', 'growth-markings', 'growth-fin-detail'):
        assert node_report[name]['topology']['boundary_edges'] == 0
    assert node_report['mouth']['topology']['boundary_edges'] == 0
    assert len(node_report['mouth']['topology']['components']) == 1
    for name, stage in (('growth-markings', 2), ('growth-fin-detail', 3)):
        assert nodes[name]['extras']['visible_from_stage'] == stage
        assert node_report[name]['triangles'] > 200
    assert len(doc['materials']) <= 3 and primitive_count <= 7
    for mat in doc['materials']:
        pbr = mat['pbrMetallicRoughness']
        assert pbr.get('baseColorFactor', [1]*4) == [1]*4
        assert pbr.get('metallicFactor', 1) == 0 and .8 <= pbr['roughnessFactor'] <= .9
        assert not mat.get('extensions') and mat.get('emissiveFactor', [0, 0, 0]) == [0, 0, 0]
        assert mat.get('alphaMode', 'OPAQUE') == 'OPAQUE'
        assert not any('Texture' in k for k in pbr)
    whole = bounds(all_points)
    dimensions = whole['dimensions']
    assert 1.9 <= dimensions[0] <= 2.2 and 1.1 <= dimensions[1] <= 1.4 and .7 <= dimensions[2] <= 1.0, dimensions
    assert max(map(abs, whole['center'])) < .30
    assert total_triangles <= 35000 and len(raw) <= 3000000
    fin_local = [sub(v, PIVOTS['pectoral-fin']) for v in geometry_by_name['pectoral-fin']]
    rest = [add((v[0]*math.cos(-.6)-v[1]*math.sin(-.6),
                 v[0]*math.sin(-.6)+v[1]*math.cos(-.6), v[2]), PIVOTS['pectoral-fin']) for v in fin_local]
    assert bounds(rest)['min'][1] < -.34 and bounds(rest)['min'][0] < -.15
    mouth_height = node_report['mouth']['local_bounds']['dimensions'][1]
    body_ratio = core['bounds']['dimensions'][1]/core['bounds']['dimensions'][0]
    assert .55 <= body_ratio <= .62, body_ratio
    mouth_protrusion = max(v[0]-front_surface(v[1], v[2])[0] for v in geometry_by_name['mouth'])
    assert mouth_protrusion < .016 and mouth_height < .09
    assert near(node_report['mouth']['world_bounds']['dimensions'][2:3], [.294])
    stages = []
    for stage, scale in enumerate((.82, 1.02, 1.27, 1.48)):
        names = [name for name in PIVOTS if not name.startswith('growth-') or stage >= (2 if name == 'growth-markings' else 3)]
        pts = [mul(v, scale) for name in names for v in (rest if name == 'pectoral-fin' else geometry_by_name[name])]
        stages.append({'stage': stage, 'scale': scale, 'visible_nodes': names,
                       'triangles': sum(node_report[name]['triangles'] for name in names), 'bounds': bounds(pts)})
    exported_version = nodes['fish-asset']['extras']['blender_version']
    assert version is None or version == exported_version
    version = exported_version
    node_report['fish-asset'] = {'pivot': [0, 0, 0], 'rotation': [0, 0, 0, 1],
        'scale': [1, 1, 1], 'vertices': 0, 'triangles': 0, 'primitives': 0,
        'children': [doc['nodes'][i]['name'] for i in nodes['fish-asset']['children']],
        'world_bounds_with_children': whole}
    result = {'status': 'PASS', 'blender_version': version, 'build_command': COMMAND,
        'verify_command': 'python apps/web-garden/art/fish-v2/build_fish_v2.py --verify-only',
        'glb_path': str(glb_path),
        'glb_sha256': hashlib.sha256(raw).hexdigest(), 'glb_bytes': len(raw),
        'blend_sha256': hashlib.sha256(BLEND.read_bytes()).hexdigest(),
        'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'blend_bytes': BLEND.stat().st_size, 'triangles': total_triangles,
        'exported_vertices': total_vertices, 'primitives': primitive_count, 'materials': len(doc['materials']),
        'budgets': {'triangles_target_max': 25000, 'triangles_hard_max': 35000,
                    'bytes_target_max': 2000000, 'bytes_hard_max': 3000000, 'primitives_max': 7, 'materials_max': 3},
        'coordinate_system': {'up': '+Y', 'forward': '+X', 'root_identity': True},
        'silhouette_checks': {'body_height_length_ratio': body_ratio, 'baked_centerline_nose_up_degrees': 5,
                              'eye_diameter': [.242, .266], 'body_max_girth_x': .204,
                              'tail_height': node_report['tail']['world_bounds']['dimensions'][1]},
        'bounds': whole, 'nodes': node_report, 'growth_stages': stages,
        'motion_checks': {'pectoral_rest_z': -.6, 'pectoral_rest_bounds': bounds(rest),
                          'mouth_local_y_scale_1_height': mouth_height,
                          'mouth_local_y_scale_3_1_height': mouth_height*3.1,
                          'mouth_front_protrusion_max': mouth_protrusion},
        'connected_body': {'anatomical_loft_components': 1, 'core_vertices': core['vertices'],
                           'closed_manifold': True, 'core_bounds': core['bounds'],
                           'detail_components': len(node_report['body']['topology']['components'])-1},
        'color_encoding': 'linear COLOR_0; white material base; opaque physically lit matte roughness .82',
        'excluded': {'images': 0, 'textures': 0, 'external_buffers': 0, 'cameras': 0,
                     'lights': 0, 'animations': 0, 'renders': 0, 'previews': 0},
        'contract_deviations': [],
        'assumptions': ['Growth geometry ships present; runtime toggles visible_from_stage nodes.',
                        'Body is one closed connected teardrop; eyes, fins and soft accents are closed attached components.',
                        'Mouth is a closed surface-following crescent; no projecting lip or snout form.',
                        'Friend palette and growth visibility are runtime responsibilities; no runtime edits.',
                        'No visual evaluation; shape is authored and checked numerically.']}
    REPORT.write_text(json.dumps(result, indent=2)+chr(10), encoding='utf-8')
    print(json.dumps({key: result[key] for key in ('status', 'blender_version', 'glb_bytes', 'triangles', 'primitives', 'materials', 'bounds')}))


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    if '--background' in args or '-b' in args:
        args = []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=glb_path, help='Explicit GLB destination; default stays in staging')
    parser.add_argument('--verify-only', action='store_true')
    options = parser.parse_args(args)
    glb_path = options.output.resolve()
    verify(None if options.verify_only else build())
