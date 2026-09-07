"""Original geometry-only aquarium fish. No image, render or preview operations.

Build: Blender --background --factory-startup --python apps/web-garden/art/fish/build_fish.py
Verify: python apps/web-garden/art/fish/build_fish.py --verify-only
"""
import collections
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

HERE = Path(__file__).resolve().parent
GLB = HERE.parent.parent / 'public/models/fish.glb'
BLEND = HERE / 'fish.blend'
REPORT = HERE / 'asset-report.json'
COMMAND = '"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python apps/web-garden/art/fish/build_fish.py'
PIVOTS = {'body': (0, 0, 0), 'tail': (-.65, 0, 0),
          'pectoral-fin': (0, -.13, .28), 'mouth': (.68, -.05, 0),
          'growth-markings': (0, 0, 0), 'growth-fin-detail': (0, 0, 0)}
APRICOT, CREAM, CORAL, INK = '#e49a64', '#ffeac1', '#c87359', '#353431'


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


# x, center Y, dorsal/ventral radius, lateral radius. The head/gill bulge is
# part of the connected loft, never a pile of overlapping ellipsoids.
SECTIONS = [(-.74, 0, .065, .045), (-.62, .005, .105, .075),
            (-.48, .015, .24, .16), (-.28, .018, .36, .255),
            (-.05, .02, .425, .315), (.18, .025, .405, .335),
            (.34, .026, .35, .322), (.49, .009, .273, .262),
            (.61, -.02, .172, .191), (.70, -.05, .081, .115)]


def section(x):
    i = next((i for i in range(len(SECTIONS)-1) if x <= SECTIONS[i+1][0]), len(SECTIONS)-2)
    a, b = SECTIONS[i], SECTIONS[i+1]
    t = (x-a[0])/(b[0]-a[0])
    out = [x]
    for k in range(1, 4):
        prev, nxt = SECTIONS[max(0, i-1)], SECTIONS[min(len(SECTIONS)-1, i+2)]
        m0 = (b[k]-prev[k])/(b[0]-prev[0])*(b[0]-a[0])
        m1 = (nxt[k]-a[k])/(nxt[0]-a[0])*(b[0]-a[0])
        out.append((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*m1)
    return out


def skin(x: float, angle: float, offset: float = 0.0):
    _, cy, ry, rz = section(x)
    y = cy + (ry+offset)*math.cos(angle)
    z = (rz+offset)*math.sin(angle)
    gill = .023*math.exp(-((x-.20)/.12)**2)*math.sin(angle)**4
    socket = .015*math.exp(-((x-.47)/.095)**2-((y-.13)/.10)**2)
    return (x, y, z + (gill-socket)*math.sin(angle))


class Geometry:
    def __init__(self, name):
        self.name = name
        self.vertices, self.faces, self.colors, self.uvs = [], [], [], []
        self.parts = []

    def vertex(self, p, color, uv=(0, 0)):
        self.vertices.append(p)
        self.colors.append(rgb(color) if isinstance(color, str) else color)
        self.uvs.append(uv)
        return len(self.vertices)-1

    def grid(self, rows, wrap=False, caps=False):
        for row, nxt in zip(rows, rows[1:]):
            for j in range(len(row) if wrap else len(row)-1):
                k = (j+1) % len(row)
                self.faces.append((row[j], row[k], nxt[k], nxt[j]))
        if caps:
            self.faces.extend([tuple(reversed(rows[0])), tuple(rows[-1])])

    def part(self, name, start):
        self.parts.append({'name': name, 'first_vertex': start,
                           'vertices': len(self.vertices)-start})

    def tube(self, name, points, radius, color, closed=False, sides=6):
        start, rows = len(self.vertices), []
        for i, p in enumerate(points):
            before = points[(i-1) % len(points)] if closed or i else points[0]
            after = points[(i+1) % len(points)] if closed or i < len(points)-1 else points[-1]
            tangent = unit(sub(after, before))
            normal = unit(cross(tangent, (0, 0, 1) if abs(tangent[2]) < .9 else (0, 1, 0)))
            binormal = cross(tangent, normal)
            r = radius if closed else radius*(.55+.45*math.sin(math.pi*i/(len(points)-1)))
            rows.append([self.vertex(add(p, add(mul(normal, r*math.cos(j*2*math.pi/sides)),
                                                   mul(binormal, r*math.sin(j*2*math.pi/sides)))),
                                     color, (i/(len(points)-1), j/sides)) for j in range(sides)])
        self.grid(rows+[rows[0]] if closed else rows, True, not closed)
        self.part(name, start)

    def fin(self, name, surface, nu, nt, color=CORAL, rays=0):
        start, grids = len(self.vertices), []
        for side in (-1, 1):
            rows = []
            for i in range(nu+1):
                u = i/nu
                rows.append([self.vertex(surface(u, j/nt, side),
                    mix(rgb(color), rgb(CREAM), .30*(j/nt)**2), (u, j/nt)) for j in range(nt+1)])
            self.grid(rows)
            grids.append(rows)
        a, b = grids
        for i in range(nu):
            for j in (0, nt):
                self.faces.append((a[i][j], b[i][j], b[i+1][j], a[i+1][j]))
        for j in range(nt):
            for i in (0, nu):
                self.faces.append((a[i][j], a[i][j+1], b[i][j+1], b[i][j]))
        self.part(name, start)
        for i in range(rays):
            u = (i+.5)/rays
            for side in (-1, 1):
                points = [surface(u, .08+.87*j/9, side) for j in range(10)]
                self.tube(name+' raised ray', points, .0055, '#f6c58e')

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
        uv = data.uv_layers.new(name='UVMap')
        for loop in data.loops:
            uv.data[loop.index].uv = self.uvs[loop.vertex_index]
        for face in data.polygons:
            face.use_smooth = True
        obj = bpy.data.objects.new(self.name, data)
        bpy.context.collection.objects.link(obj)
        obj.parent, obj.location = parent, P(pivot)
        obj['anatomical_parts'] = json.dumps(self.parts)
        if self.name.startswith('growth-'):
            obj['visible_from_stage'] = 2 if self.name == 'growth-markings' else 3
        return obj


def tail_surface(u, t, side):
    v = u*2-1
    return (-.65-t*(.50+.08*abs(v)**1.4), v*(.06+.40*t),
            .023*math.sin(math.pi*t)*math.cos(v*math.pi/2)+side*(.018-.012*t))


def dorsal_surface(u, t, side):
    x = -.56+.84*u
    base = skin(x, 0)[1]-.018
    return (x-.08*t, base+t*(.08+.25*math.sin(math.pi*u)**.8),
            .025*math.sin(math.pi*t)*math.sin(math.pi*u)+side*(.026-.019*t))


def pectoral_surface(u, t, side, opposite=False):
    v = 2*u-1
    x, y = v*(.027+.13*t)-.065*t*t, -.13-.29*t+.055*v*t
    z = .28+.14*t+.023*math.sin(math.pi*t)+side*(.012-.007*t)
    if opposite:
        # Bake the opposite fin's rest angle into body-owned geometry.
        x, y = x*math.cos(-.6)-(y+.13)*math.sin(-.6), x*math.sin(-.6)+(y+.13)*math.cos(-.6)-.13
        z = -z
    return (x, y, z)


def eye(body, side):
    start, rows = len(body.vertices), []
    # Socket rim, ivory sclera, honey iris and convex charcoal pupil are
    # one radial patch per eye, not several stacked spheres.
    profile = [(1, .0, CORAL), (.92, .019, CREAM), (.73, .035, CREAM),
               (.60, .044, '#9e7047'), (.46, .052, INK), (.19, .058, INK)]
    for r, depth, color in profile:
        rows.append([body.vertex((.465+.112*r*math.cos(a), .13+.131*r*math.sin(a),
                                 side*(.252+depth)), color, (.5+.5*r*math.cos(a), .5+.5*r*math.sin(a)))
                     for a in [j*2*math.pi/32 for j in range(32)]])
    body.grid(rows, True)
    tip = body.vertex((.465, .13, side*.312), INK, (.5, .5))
    for j in range(32):
        body.faces.append((rows[-1][j], rows[-1][(j+1)%32], tip))
    body.part('socket-sclera-iris-pupil-'+str(side), start)
    points = [(.489+.012*math.cos(a), .164+.015*math.sin(a), side*.312)
              for a in [j*2*math.pi/12 for j in range(12)]]
    body.tube('ivory eye glint', points, .004, '#fff5dd', True)


def make_geometry():
    body = Geometry('body')
    rows = []
    for i in range(65):
        x = -.74+1.44*i/64
        row = []
        for j in range(48):
            angle = 2*math.pi*j/48
            p = skin(x, angle)
            belly = max(0, min(1, (-p[1]+.10)/.38))
            color = mix(rgb(APRICOT), rgb(CREAM), belly*.84)
            row.append(body.vertex(p, color, (i/64, j/48)))
        rows.append(row)
    body.grid(rows, True, True)
    body.part('connected-anatomical-loft', 0)
    body.fin('curved dorsal membrane', dorsal_surface, 20, 7, '#dc9566', 9)
    body.fin('opposite pectoral membrane', lambda u, t, s: pectoral_surface(u, t, s, True), 12, 7, CORAL, 5)
    body.fin('ventral keel membrane', lambda u, t, s: (-.49+.43*u-.055*t,
        skin(-.49+.43*u, math.pi)[1]+.014-t*(.07+.105*math.sin(math.pi*u)),
        s*(.016-.009*t)), 12, 5, '#d99068', 4)
    for side in (-1, 1):
        eye(body, side)
        points = [skin(.22-.075*math.sin(math.pi*j/20), side*(.76+1.60*j/20), .009)
                  for j in range(21)]
        body.tube('operculum carved edge', points, .010, '#ae664e')
        points = [skin(.255-.065*math.sin(math.pi*j/20), side*(.80+1.49*j/20), .013)
                  for j in range(21)]
        body.tube('operculum raised cream rim', points, .008, '#f1b67f')
    tail = Geometry('tail')
    tail.fin('curved forked caudal membrane', tail_surface, 24, 10, CORAL, 11)
    fin = Geometry('pectoral-fin')
    fin.fin('curved animated pectoral membrane', pectoral_surface, 14, 8, CORAL, 6)
    mouth = Geometry('mouth')
    # Continuous projecting annular lips fold inward to a recessed dark cavity.
    # The rear rim embeds in the snout; local Y scale opens the whole mouth.
    rows = []
    for x, ry, rz, color in [(.690, .081, .119, APRICOT), (.746, .094, .136, '#f0b17d'),
                            (.815, .076, .117, CREAM), (.829, .052, .089, '#e4a073'),
                            (.777, .041, .074, '#995440'), (.731, .026, .051, '#633e35')]:
        rows.append([mouth.vertex((x, -.05+ry*math.cos(a), rz*math.sin(a)), color,
                                  (j/40, (x-.68)/.16)) for j in range(40) for a in [j*2*math.pi/40]])
    mouth.grid(rows, True)
    center = mouth.vertex((.728, -.05, 0), '#633e35', (.5, .5))
    for j in range(40):
        mouth.faces.append((rows[-1][j], rows[-1][(j+1)%40], center))
    mouth.part('projecting-annular-lip-and-recessed-opening', 0)
    markings = Geometry('growth-markings')
    for x in (-.32, -.075):
        points = [skin(x+.025*math.cos(3*a), a, .012) for a in [j*2*math.pi/64 for j in range(64)]]
        markings.tube('mature raised cream band', points, .014, CREAM, True, 8)
    for side in (-1, 1):
        for x in (-.43, -.21, .015):
            for angle in (1.20, 1.83):
                points = [skin(x-.032*math.sin(math.pi*j/10), side*(angle-.18+.36*j/10), .016)
                          for j in range(11)]
                markings.tube('mature scalloped scale relief', points, .007, '#ffe0a5')
    detail = Geometry('growth-fin-detail')
    detail.fin('mature scalloped dorsal extension', lambda u, t, s:
        add(dorsal_surface(.14+.71*u, 1, s), (-.027*t, t*(.045+.04*math.sin(5*math.pi*u)**2), s*.001)),
        24, 3, '#efbb82', 0)
    for side in (-1, 1):
        points = [add(dorsal_surface(.14+.71*j/36, 1, side), (-.027, .045+.04*math.sin(5*math.pi*j/36)**2, side*.001))
                  for j in range(37)]
        detail.tube('mature cream dorsal edging', points, .006, CREAM)
    return [body, tail, fin, mouth, markings, detail]


def build():
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.file_preview_type = 'NONE'
    mat = bpy.data.materials.new('apricot-satin-vertex-color')
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
    shader.inputs['Roughness'].default_value = .48
    shader.inputs['Metallic'].default_value = 0
    vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'Color'
    mat.node_tree.links.new(vertex.outputs['Color'], shader.inputs['Base Color'])
    root = bpy.data.objects.new('fish-asset', None)
    bpy.context.collection.objects.link(root)
    root['forward_axis'], root['final_up_axis'] = '+X', '+Y'
    root['blender_version'] = bpy.app.version_string
    root['original_design'] = 'Apricot ripplefish: continuous cheek loft, ribbed curved fins, raised mature bands'
    for geometry in make_geometry():
        geometry.object(root, mat)
    bpy.context.scene['authoring_policy'] = 'Geometry only; no preview scene or image operations'
    bpy.ops.object.select_all(action='SELECT')
    GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB', use_selection=True,
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
    raw = GLB.read_bytes()
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
            'uv_span': uv_span, 'linear_color_min': [min(c[i] for c in colors) for i in range(3)],
            'linear_color_max': [max(c[i] for c in colors) for i in range(3)], 'topology': topo}
    core = node_report['body']['topology']['components'][0]
    assert core['vertices'] == 65*48 and core['boundary_edges'] == core['nonmanifold_edges'] == 0
    assert near(core['bounds']['min'][0:1], [-.74]) and near(core['bounds']['max'][0:1], [.70])
    for name in ('tail', 'pectoral-fin', 'growth-markings', 'growth-fin-detail'):
        assert node_report[name]['topology']['boundary_edges'] == 0
    assert node_report['mouth']['topology']['boundary_edges'] == 40
    assert len(node_report['mouth']['topology']['components']) == 1
    for name, stage in (('growth-markings', 2), ('growth-fin-detail', 3)):
        assert nodes[name]['extras']['visible_from_stage'] == stage
        assert node_report[name]['triangles'] > 200
    assert len(doc['materials']) <= 3 and primitive_count <= 7
    for mat in doc['materials']:
        pbr = mat['pbrMetallicRoughness']
        assert pbr.get('baseColorFactor', [1]*4) == [1]*4
        assert pbr.get('metallicFactor', 1) == 0 and .4 <= pbr['roughnessFactor'] <= .6
        assert mat.get('alphaMode', 'OPAQUE') == 'OPAQUE'
        assert not any('Texture' in k for k in pbr)
    whole = bounds(all_points)
    dimensions = whole['dimensions']
    assert 1.9 <= dimensions[0] <= 2.2 and 1.1 <= dimensions[1] <= 1.4 and .7 <= dimensions[2] <= 1.0, dimensions
    assert max(map(abs, whole['center'])) < .21
    assert total_triangles <= 25000 and len(raw) <= 2000000
    fin_local = [sub(v, PIVOTS['pectoral-fin']) for v in geometry_by_name['pectoral-fin']]
    rest = [add((v[0]*math.cos(-.6)-v[1]*math.sin(-.6),
                 v[0]*math.sin(-.6)+v[1]*math.cos(-.6), v[2]), PIVOTS['pectoral-fin']) for v in fin_local]
    assert bounds(rest)['min'][1] < -.34 and bounds(rest)['min'][0] < -.20
    mouth_height = node_report['mouth']['local_bounds']['dimensions'][1]
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
        'verify_command': 'python apps/web-garden/art/fish/build_fish.py --verify-only',
        'glb_sha256': hashlib.sha256(raw).hexdigest(), 'glb_bytes': len(raw),
        'blend_sha256': hashlib.sha256(BLEND.read_bytes()).hexdigest(),
        'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'blend_bytes': BLEND.stat().st_size, 'triangles': total_triangles,
        'exported_vertices': total_vertices, 'primitives': primitive_count, 'materials': len(doc['materials']),
        'budgets': {'triangles_target_max': 25000, 'triangles_hard_max': 35000,
                    'bytes_target_max': 2000000, 'bytes_hard_max': 3000000, 'primitives_max': 7, 'materials_max': 3},
        'coordinate_system': {'up': '+Y', 'forward': '+X', 'root_identity': True},
        'bounds': whole, 'nodes': node_report, 'growth_stages': stages,
        'motion_checks': {'pectoral_rest_z': -.6, 'pectoral_rest_bounds': bounds(rest),
                          'mouth_local_y_scale_1_height': mouth_height,
                          'mouth_local_y_scale_3_1_height': mouth_height*3.1},
        'connected_body': {'anatomical_loft_components': 1, 'core_vertices': core['vertices'],
                           'closed_manifold': True, 'core_bounds': core['bounds'],
                           'detail_components': len(node_report['body']['topology']['components'])-1},
        'color_encoding': 'linear COLOR_0; white material base; opaque satin roughness .48',
        'excluded': {'images': 0, 'textures': 0, 'external_buffers': 0, 'cameras': 0,
                     'lights': 0, 'animations': 0, 'renders': 0, 'previews': 0},
        'contract_deviations': [],
        'assumptions': ['Growth geometry ships present; runtime toggles visible_from_stage nodes.',
                        'Body loft is one closed connected manifold; eyes, fins and relief are attached surface components.',
                        'Mouth rear annular boundary embeds in the snout; oral cavity is recessed and capped.',
                        'Friend palette and growth visibility are runtime responsibilities; no runtime edits.',
                        'No visual evaluation; shape is authored and checked numerically.']}
    REPORT.write_text(json.dumps(result, indent=2)+chr(10), encoding='utf-8')
    print(json.dumps({key: result[key] for key in ('status', 'blender_version', 'glb_bytes', 'triangles', 'primitives', 'materials', 'bounds')}))


if __name__ == '__main__':
    verify(None if '--verify-only' in sys.argv else build())
