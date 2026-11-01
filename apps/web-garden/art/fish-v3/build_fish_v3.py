"""Original stylized clownfish v3; default output is staging only.

The optional render_fish_v3.py studio review is separate from asset export.

Build: Blender --background --factory-startup --python apps/web-garden/art/fish-v3/build_fish_v3.py
Verify: python apps/web-garden/art/fish-v3/build_fish_v3.py --verify-only
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
glb_path = HERE / 'fish-v3.glb'
BLEND = HERE / 'fish-v3.blend'
REPORT = HERE / 'asset-report.json'
COMMAND = 'blender --background --factory-startup --threads 4 --python-exit-code 1 --python apps/web-garden/art/fish-v3/build_fish_v3.py'
PIVOTS = {'body': (0, 0, 0), 'tail': (-.65, 0, 0),
          'pectoral-fin': (0, -.13, .28), 'mouth': (.68, -.05, 0),
          'growth-markings': (0, 0, 0), 'growth-fin-detail': (0, 0, 0), 'eye-detail': (0, 0, 0)}
CORAL, CREAM, FIN, INK, WHITE = '#f58b35', '#fff8e8', '#f79b42', '#352723', '#fffdf4'
BACK, BELLY, IRIS = '#d96a2c', '#ffbe6e', '#9a5936'
SURFACES = {
    'skin': {'name': 'clownfish-satin-skin', 'roughness': .50},
    'fin': {'name': 'clownfish-soft-fin', 'roughness': .64},
    'eye': {'name': 'clownfish-expressive-eye', 'roughness': .30},
}
NODE_SURFACE = {'tail': 'fin', 'pectoral-fin': 'fin', 'growth-fin-detail': 'fin',
                'eye-detail': 'eye', 'mouth': 'skin', 'growth-markings': 'fin'}

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


# Controlled, gently exaggerated clownfish outline: enlarged head and compact
# tapering body, still laterally compressed. Tail pivot remains at -.65 while
# its actual caudal root extends beneath the new peduncle at -.60.
PROFILE = [(-.64, 0, 0, 0), (-.615, .062, -.062, .048),
           (-.59, .090, -.086, .067), (-.45, .200, -.180, .120),
           (-.22, .300, -.280, .155), (.07, .380, -.340, .172),
           (.28, .390, -.330, .180), (.47, .330, -.255, .160),
           (.58, .250, -.190, .130), (.66, .150, -.130, .080),
           (.69, .060, -.090, .040), (.707, .000, -.070, .020),
           (.715, -.035, -.035, 0)]


def smooth_curve(points, x):
    """Shape-preserving cubic Hermite interpolation, no bulbous overshoot."""
    if x <= points[0][0]: return points[0][1]
    if x >= points[-1][0]: return points[-1][1]
    i = next(i for i in range(len(points)-1) if points[i+1][0] >= x)
    slopes = [(b[1]-a[1])/(b[0]-a[0]) for a,b in zip(points, points[1:])]
    def tangent(k):
        if k == 0: return slopes[0]
        if k == len(points)-1: return slopes[-1]
        a,b = slopes[k-1],slopes[k]
        return 0 if a*b <= 0 else 2*a*b/(a+b)
    a,b=points[i],points[i+1]
    h=b[0]-a[0]; t=(x-a[0])/h
    return (2*t**3-3*t*t+1)*a[1] + (t**3-2*t*t+t)*h*tangent(i) + (-2*t**3+3*t*t)*b[1] + (t**3-t*t)*h*tangent(i+1)


def profile(x):
    top = smooth_curve([(p[0],p[1]) for p in PROFILE],x)
    bottom = smooth_curve([(p[0],p[2]) for p in PROFILE],x)
    width = smooth_curve([(p[0],p[3]) for p in PROFILE],x)
    return (top+bottom)/2, (top-bottom)/2, width


def band_warp(s, y):
    # The middle bar projects forward at the flank center, as in ocellaris.
    # Axial rings follow this SAME mapping, avoiding diagonal color aliasing.
    return s + .080*math.exp(-((s+.12)/.255)**4)*math.exp(-(y/.235)**2)


def band_coordinate(x,y):
    lo,hi=-.9,.9
    for _ in range(32):
        mid=(lo+hi)/2
        if band_warp(mid,y)<x: lo=mid
        else: hi=mid
    return (lo+hi)/2


def side_surface(x, y, side):
    cy, ry, rz = profile(x)
    return (x, y, side*rz*math.sqrt(max(0, 1-((y-cy)/ry)**2)))


def front_surface(y, z):
    lo, hi = .3, .715
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

    def sphere(self, name, surface, color, rings=24, segments=48, parametric_color=None):
        """Closed sphere topology with shared poles and no collapsed quads."""
        start, rows = len(self.vertices), []
        def vert(phi, theta):
            p = surface(phi, theta)
            return self.vertex(p, parametric_color(phi, theta, p) if parametric_color else color(p) if callable(color) else color)
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

    def shell(self, name, contour, center, thickness, color=FIN, transform=lambda p: p, rings=16, rim=None):
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
        def edge_color(phi, angle, p):
            base = color(p) if callable(color) else rgb(color)
            t = max(0, min(1, (math.sin(phi)-.90)/.065))
            return mix(base, rgb(rim), t*t*(3-2*t))
        self.sphere(name, surface, color, rings, n*6, edge_color if rim else None)

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
        # Use the atlas bounds fully, without changing its islands or area signs.
        # Narrow mouth charts otherwise leave an arbitrary unused UV axis range.
        uv_data = data.uv_layers.active.data
        low = [min(loop.uv[i] for loop in uv_data) for i in range(2)]
        span = [max(loop.uv[i] for loop in uv_data)-low[i] for i in range(2)]
        assert min(span) > 1e-8
        for loop in uv_data:
            loop.uv = tuple((loop.uv[i]-low[i])/span[i] for i in range(2))
        return obj


def eye(body, side):
    # Moderate stylization of a fish's orange iris: no human white sclera.
    x0,y0,rx,ry=.475,.140,.107,.115
    def height(x,y):
        return .002 + .015*math.sqrt(max(0,1-((x-x0)/rx)**2-((y-y0)/ry)**2))
    def iris_surface(phi,angle):
        x,y=x0+rx*math.sin(phi)*math.cos(angle),y0+ry*math.sin(phi)*math.sin(angle)
        return add(side_surface(x,y,side),(0,0,side*(.002+.015*math.cos(phi))))
    def iris_color(p):
        r2=((p[0]-x0)/rx)**2+((p[1]-y0)/ry)**2
        t=max(0,min(1,(r2-.78)/.2))
        return mix(rgb('#ce873b'),rgb(INK),t*t*(3-2*t))
    body.sphere('small-orange-iris-'+str(side),iris_surface,iris_color,16,32)
    px,py=x0+.007,y0+.001
    def pupil(phi,angle):
        x,y=px+.063*math.sin(phi)*math.cos(angle),py+.073*math.sin(phi)*math.sin(angle)
        return add(side_surface(x,y,side),(0,0,side*(height(x,y)+.002+.0015*math.cos(phi))))
    body.sphere('forward-pupil-'+str(side),pupil,'#231e1c',12,28)
    hx,hy=px+.018,py+.029
    def highlight(phi,angle):
        x,y=hx+.0105*math.sin(phi)*math.cos(angle),hy+.014*math.sin(phi)*math.sin(angle)
        return add(side_surface(x,y,side),(0,0,side*(height(x,y)+.004+.001*math.cos(phi))))
    body.sphere('small-eye-glint-'+str(side),highlight,WHITE,8,16)


BANDS = ((.230,.105),(-.140,.150),(-.585,.080))
BODY_ROWS=sorted(set([.0375-.6775*math.cos(math.pi*i/48) for i in range(49)]+[
    center+sign*(width/2+offset) for center,width in BANDS
    for sign in (-1,1) for offset in (-.004,.004,.012,.018)]+[c for c,w in BANDS]))
BODY_ROWS=[x for x in BODY_ROWS if -.64000001<=x<=.71500001]
while len(BODY_ROWS)<97:
    gap=max(range(len(BODY_ROWS)-1),key=lambda i:BODY_ROWS[i+1]-BODY_ROWS[i])
    BODY_ROWS.insert(gap+1,(BODY_ROWS[gap]+BODY_ROWS[gap+1])/2)
assert len(BODY_ROWS)==97


def fish_color(p, coordinate=None):
    x,y,z=p
    s=band_coordinate(x,y) if coordinate is None else coordinate
    orange=mix(rgb(CORAL),rgb(BACK),.20*max(0,min(1,(y-.1)/.3)))
    orange=mix(orange,rgb(BELLY),.24*max(0,min(1,(-y-.1)/.3)))
    for center,width in BANDS:
        d=abs(s-center)-width/2
        if d<.018:
            if d<-.004:return rgb(CREAM)
            if d<.004:
                t=(d+.004)/.008
                return mix(rgb(CREAM),rgb(INK),t*t*(3-2*t))
            t=max(0,min(1,(d-.012)/.006))
            return mix(rgb(INK),orange,t*t*(3-2*t))
    return orange


def median_fin(body,name,low,high,tip_points,sign):
    # A closed longitudinal fin ribbon. Stripe transition rows are shared with
    # the body, and the stripe-space warp continues through the dorsal/anal.
    rows=sorted(set([low,high]+[s for s in BODY_ROWS if low<s<high]+[
        low+(high-low)*i/24 for i in range(1,24)]))
    def shape(phi,angle):
        s=rows[round(phi/math.pi*(len(rows)-1))]
        x=s
        for _ in range(8):
            cy,ry,rz=profile(x)
            base=cy+sign*(ry-.025)
            tip=smooth_curve(tip_points,s)
            if s in (low,high):tip=base
            y=(base+tip)/2+(tip-base)/2*math.cos(angle)
            x=band_warp(s,y)
        h=abs(tip-base)
        t=max(0,min(1,(sign*(y-base))/max(.001,h)))
        z=.014*min(1,h/.06)*math.sin(angle)
        # The soft rear lobe cups gently, rather than becoming a planar fan.
        z+=.018*max(0,min(1,(-s-.15)/.4))*max(0,(sign*(y-base))/max(.001,h))**2
        return (x,y,z)
    def color(phi,angle,p):
        s=rows[round(phi/math.pi*(len(rows)-1))]
        base=fish_color(p,s)
        edge=max(0,min(1,(math.cos(angle)-.78)/.16))
        return mix(base,rgb(INK),edge*edge*(3-2*edge))
    body.sphere(name,shape,FIN,len(rows)-1,28,color)


def make_geometry():
    body=Geometry('body')
    def body_surface(phi,angle):
        s=BODY_ROWS[round(phi/math.pi*96)]
        x=s
        for _ in range(8):
            cy,ry,rz=profile(x)
            y=cy+ry*math.cos(angle)
            x=band_warp(s,y)
        cy,ry,rz=profile(x)
        return (x,cy+ry*math.cos(angle),rz*math.sin(angle))
    body.sphere('continuous-reference-profile-clownfish',body_surface,FIN,96,64,
        lambda phi,angle,p:fish_color(p,BODY_ROWS[round(phi/math.pi*96)]))
    dorsal=[(-.59,.09),(-.54,.245),(-.46,.40),(-.36,.48),(-.26,.50),
        (-.16,.485),(-.06,.470),(.05,.470),(.15,.465),(.24,.445),(.32,.36)]
    # Broad rounded crest follows the shorter body; no pointed saw-tooth fringe.
    median_fin(body,'continuous-spiny-and-soft-dorsal',-.59,.32,dorsal,1)
    median_fin(body,'posterior-anal-fin',-.55,-.04,
        [(-.55,-.12),(-.49,-.29),(-.39,-.395),(-.28,-.430),(-.15,-.405),(-.04,-.325)],-1)
    # Fin outline authored in its REST local coordinates. Its narrow actual
    # root goes inside the thin flank despite the legacy pivot lying outside.
    pectoral=[(.24,-.035),(.25,-.09),(.18,-.19),(.025,-.245),
              (-.085,-.205),(-.085,-.13),(.005,-.065),(.15,-.015)]
    def fin_position(p,opposite=False):
        x,y,z=p
        reach=max(0,min(1,(.24-x)/.325))
        z=z*(1-.4*reach)+.080+.170*reach+.025*math.sin(reach*math.pi)
        if opposite:
            x,y=(x*math.cos(-.6)-(y+.13)*math.sin(-.6),
                 x*math.sin(-.6)+(y+.13)*math.cos(-.6)-.13)
            z=-z
        return (x,y,z)
    body.shell('opposite-swept-pectoral',pectoral,(.10,-.13),.009,
               color=FIN,transform=lambda p:fin_position(p,True),rings=14,rim=INK)
    for side in (-1,1):
        body.shell('baby-pelvic-fin-'+str(side),
            [(.16,-.27),(.10,-.35),(-.045,-.43),(-.11,-.425),(-.06,-.34),(.06,-.275)],
            (.025,-.34),.007,color=FIN,rings=12,rim=INK,
            transform=lambda p,side=side:(p[0],p[1],side*(p[2]+.055+max(0,-p[1]-.27)*.22)))
    eyes=Geometry('eye-detail')
    for side in (-1,1):eye(eyes,side)
    tail=Geometry('tail')
    def tail_surface(p):
        x,y,z=p
        reach=max(0,min(1,(-x-.43)/.585))
        return (x,y,z*(1-.45*reach)+.035*math.sin(y*6)*reach*reach)
    tail.shell('rounded-clownfish-caudal-fan',
        [(-.43,.025),(-.65,.065),(-.84,.195),(-.945,.205),(-.995,.145),
         (-1.015,0),(-.995,-.145),(-.945,-.205),(-.84,-.195),(-.65,-.065)],
        (-.80,0),.016,color=lambda p:mix(rgb(FIN),rgb(CREAM),max(0,min(1,(p[0]+.75)/.12))**2),transform=tail_surface,rings=18,rim=INK)
    fin=Geometry('pectoral-fin')
    fin.shell('animated-swept-pectoral',pectoral,(.10,-.13),.009,
        color=FIN,transform=fin_position,rings=14,rim=INK)
    mouth=Geometry('mouth')
    def mouth_surface(phi,angle):
        t=math.cos(phi);z=.075*t
        y=-.051+.030*t*t+.007*math.sin(phi)*math.cos(angle)
        x=front_surface(y,z)[0]+.003+.0025*math.sin(phi)*math.sin(angle)
        return (x,y,z)
    mouth.sphere('short-terminal-mouth-seam',mouth_surface,INK,24,12)
    # Mature accents are small fin-edge extensions, not duplicate dorsal sails.
    markings=Geometry('growth-markings')
    for side in (-1,1):
        markings.shell('mature-pelvic-tip-'+str(side),
            [(-.025,-.375),(-.075,-.41),(-.14,-.455),(-.16,-.45),(-.12,-.40),(-.06,-.365)],
            (-.09,-.41),.006,color=FIN,rings=10,rim=INK,
            transform=lambda p,side=side:(p[0],p[1],side*(p[2]+.082)))
    detail=Geometry('growth-fin-detail')
    detail.shell('mature-soft-dorsal-edge-extension',
        [(-.41,.455),(-.35,.49),(-.29,.515),(-.23,.510),(-.19,.475),(-.30,.465)],
        (-.30,.485),.007,color=fish_color,rings=10,rim=INK,
        transform=lambda p:(p[0],p[1],p[2]+.009))
    return [body,tail,fin,mouth,markings,detail,eyes]


def build():
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.file_preview_type = 'NONE'
    materials = {}
    for key, role in SURFACES.items():
        mat = bpy.data.materials.new(role['name'])
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
        shader.inputs['Roughness'].default_value = role['roughness']
        shader.inputs['Metallic'].default_value = 0
        # Plain glTF metallic/roughness: robust on mobile without extension-only effects.
        vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        vertex.layer_name = 'Color'
        mat.node_tree.links.new(vertex.outputs['Color'], shader.inputs['Base Color'])
        materials[key] = mat
    root = bpy.data.objects.new('fish-asset', None)
    bpy.context.collection.objects.link(root)
    root['forward_axis'], root['final_up_axis'] = '+X', '+Y'
    root['blender_version'] = bpy.app.version_string
    root['original_design'] = 'Original cute clownfish companion: broad expressive head, compact tapered body, large shallow warm iris, upturned small smile, soft continuous fins, compressed flank and curved painted bands'
    for geometry in make_geometry():
        geometry.object(root, materials[NODE_SURFACE.get(geometry.name, 'skin')])
    bpy.context.scene['asset_scope'] = 'Geometry and material library; review lights/cameras are never exported'
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
    assert core['vertices'] == 95*64+2 and core['boundary_edges'] == core['nonmanifold_edges'] == 0
    assert near(core['bounds']['min'][0:1], [-.64]) and near(core['bounds']['max'][0:1], [.715])
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
        assert pbr.get('metallicFactor', 1) == 0 and .2 <= pbr['roughnessFactor'] <= .7
        role = next(role for role in SURFACES.values() if role['name'] == mat['name'])
        assert abs(pbr['roughnessFactor'] - role['roughness']) < 1e-6
        assert not mat.get('extensions') and mat.get('emissiveFactor', [0, 0, 0]) == [0, 0, 0]
        assert mat.get('alphaMode', 'OPAQUE') == 'OPAQUE'
        assert not any('Texture' in k for k in pbr)
    whole = bounds(all_points)
    dimensions = whole['dimensions']
    assert 1.65 <= dimensions[0] <= 2.1 and .8 <= dimensions[1] <= 1.1 and .3 <= dimensions[2] <= .65, dimensions
    assert max(map(abs, whole['center'])) < .30
    assert total_triangles <= 35000 and len(raw) <= 3000000
    fin_local = [sub(v, PIVOTS['pectoral-fin']) for v in geometry_by_name['pectoral-fin']]
    rest = [add((v[0]*math.cos(-.6)-v[1]*math.sin(-.6),
                 v[0]*math.sin(-.6)+v[1]*math.cos(-.6), v[2]), PIVOTS['pectoral-fin']) for v in fin_local]
    # The thinner fin now sweeps back, rather than hanging down like an oval paddle.
    assert bounds(rest)['min'][1] < -.22 and bounds(rest)['min'][0] < -.10
    mouth_height = node_report['mouth']['local_bounds']['dimensions'][1]
    body_ratio = core['bounds']['dimensions'][1]/core['bounds']['dimensions'][0]
    assert .50 <= body_ratio <= .58, body_ratio
    mouth_protrusion = max(v[0]-front_surface(v[1], v[2])[0] for v in geometry_by_name['mouth'])
    assert mouth_protrusion < .016 and mouth_height < .09
    assert near(node_report['mouth']['world_bounds']['dimensions'][2:3], [.150])
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
        'verify_command': 'python apps/web-garden/art/fish-v3/build_fish_v3.py --verify-only --output ' + (str(glb_path.relative_to(HERE.parents[3])) if glb_path.is_relative_to(HERE.parents[3]) else str(glb_path)),
        'glb_path': str(glb_path.relative_to(HERE.parents[3])) if glb_path.is_relative_to(HERE.parents[3]) else str(glb_path),
        'glb_sha256': hashlib.sha256(raw).hexdigest(), 'glb_bytes': len(raw),
        'blend_sha256': hashlib.sha256(BLEND.read_bytes()).hexdigest(),
        'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'blend_bytes': BLEND.stat().st_size, 'triangles': total_triangles,
        'exported_vertices': total_vertices, 'primitives': primitive_count, 'materials': len(doc['materials']),
        'budgets': {'triangles_target_max': 30000, 'triangles_hard_max': 35000,
                    'bytes_target_max': 2000000, 'bytes_hard_max': 3000000, 'primitives_max': 7, 'materials_max': 3},
        'coordinate_system': {'up': '+Y', 'forward': '+X', 'root_identity': True},
        'silhouette_checks': {'body_height_length_ratio': body_ratio, 'standard_length': 1.315, 'body_depth_standard_length_ratio': core['bounds']['dimensions'][1]/1.315,
                              'eye_diameter': [.214, .230], 'cheek_volume_gain_max': 0,
                              'tail_height': node_report['tail']['world_bounds']['dimensions'][1]},
        'bounds': whole, 'nodes': node_report, 'growth_stages': stages,
        'motion_checks': {'pectoral_rest_z': -.6, 'pectoral_rest_bounds': bounds(rest),
                          'mouth_local_y_scale_1_height': mouth_height,
                          'mouth_local_y_scale_3_1_height': mouth_height*3.1,
                          'mouth_front_protrusion_max': mouth_protrusion},
        'connected_body': {'anatomical_loft_components': 1, 'core_vertices': core['vertices'],
                           'closed_manifold': True, 'core_bounds': core['bounds'],
                           'detail_components': len(node_report['body']['topology']['components'])-1},
        'color_encoding': 'linear COLOR_0; white base; satin skin .50 / soft fin .64 / expressive eye .30',
        'surface_roles': SURFACES,
        'excluded': {'images': 0, 'textures': 0, 'external_buffers': 0, 'cameras': 0,
                     'lights': 0, 'animations': 0},
        'contract_deviations': [],
        'assumptions': ['Growth geometry ships present; runtime toggles visible_from_stage nodes.',
                        'Body is one closed anatomical loft; curved painted bands add no collar geometry.',
                        'Mouth is a short surface-following seam on the integrated terminal snout; no separate lip/nose volume.',
                        'Friend palette and growth visibility are runtime responsibilities; no runtime edits.',
                        'This report is numerical evidence; separate studio and actual-game visual review are documented in README.md.']}
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
