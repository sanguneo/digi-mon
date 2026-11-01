"""Refined cute marine prop library. Blender 4.3.2; separate actual-GLB studio review.

blender --background --factory-startup --python-exit-code 1 --python build_props_english.py
Geometry is authored Y-up, baked to Blender Z-up, and exported Y-up.
Every object has identity transforms; each part is one independently usable mesh.
"""
from pathlib import Path
import json
import hashlib
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
        self.face_roles, self.role = [], 'matte'

    def vertex(self, xyz, color):
        self.vertices.append(tuple(xyz))
        self.colors.append(linear(color) if isinstance(color, str) else color(tuple(xyz)) if callable(color) else color)
        return len(self.vertices) - 1

    def face(self, *indices):
        self.faces.append(tuple(indices))
        self.face_roles.append(self.role)

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
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, affect='EDGES')
        ids = {v: self.vertex(tuple(v.co[a] + center[a] for a in range(3)), color) for v in bm.verts}
        for face in bm.faces:
            self.face(*(ids[v] for v in face.verts))
        bm.free()


def blend_color(a,b,t):
    a,b=linear(a),linear(b)
    return tuple(x*(1-t)+y*t for x,y in zip(a,b))


def shell():
    s=Shape();s.role='satin'
    # Thick concave upper valve: interior recedes behind the scalloped rim.
    steps,rings=48,9;layers=[]
    for back in (False,True):
        tip=s.vertex((0,.075,-.125 if back else -.075),'#dcac9b' if back else '#f4dfc8')
        rows=[]
        for j in range(1,rings+1):
            t=j/rings;row=[]
            for i in range(steps+1):
                a=i*math.pi/steps;flute=.5+.5*math.cos(a*18)
                scallop=1-.035*(1-flute)*t**4
                x=.68*math.cos(a)*t*scallop;y=.075+.825*math.sin(a)*t*scallop
                inner=-.075+.24*t*t+.014*flute*t
                z=inner-(.060+.015*math.sin(math.pi*t)) if back else inner
                c=blend_color('#e8c4af' if back else '#eacbb5','#fff0dc',(.25+.75*flute)*(.35+.65*t))
                row.append(s.vertex((x,y,z),c))
            rows.append(row)
        for i in range(steps):s.face(tip,rows[0][i],rows[0][i+1])
        for a,b in zip(rows,rows[1:]):
            for i in range(steps):s.face(a[i],b[i],b[i+1],a[i+1])
        layers.append((tip,rows))
    front,back=layers
    for i in range(steps):s.face(front[1][-1][i],back[1][-1][i],back[1][-1][i+1],front[1][-1][i+1])
    for edge in (0,steps):
        a=[front[0]]+[r[edge] for r in front[1]];b=[back[0]]+[r[edge] for r in back[1]]
        for j in range(rings):s.face(a[j],b[j],b[j+1],a[j+1])
    # Lower valve is a real open dish with wall thickness and a recessed floor.
    layers=[]
    for outside in (False,True):
        center=s.vertex((0,.025 if outside else .075,.10),'#e9c3ac' if outside else '#fff0d8');rows=[]
        for j in range(1,6):
            t=j/5;row=[]
            for i in range(32):
                a=i*TAU/32;flute=.5+.5*math.cos(a*12)
                row.append(s.vertex((.45*t*math.cos(a),(.025 if outside else .075)+(.140 if outside else .095)*t*t,.10+.27*t*math.sin(a)),blend_color('#ecc9ae','#fff0dc',.3+.5*t+.15*flute)))
            rows.append(row)
        for i in range(32):s.face(center,rows[0][i],rows[0][(i+1)%32])
        for a,b in zip(rows,rows[1:]):
            for i in range(32):s.face(a[i],b[i],b[(i+1)%32],a[(i+1)%32])
        layers.append(rows[-1])
    for i in range(32):s.face(layers[0][i],layers[1][i],layers[1][(i+1)%32],layers[0][(i+1)%32])
    s.sphere((0,.205,.10),(.13,.13,.13),'#fff1d6',24,14)
    s.feature('concave-fluted-upper-valve',ribs=9,wall_thickness=.06)
    s.feature('open-lower-pearl-cradle',recessed_floor=True,pearl_seated=True)
    return s


def kelp():
    s=Shape()
    blades=[(-.23,-.35,.88,-.35),(-.12,-.16,1.08,.15),(0,.07,1.20,-.12),(.14,.38,.99,.5),(.24,.17,.75,-.4)]
    for blade,(base,lean,height,phase) in enumerate(blades):
        rows=[]
        for j in range(25):
            t=j/24;wave=math.sin(math.pi*t)
            x=base+lean*(t*t*(3-2*t))+.08*math.sin(t*TAU+phase)*wave
            y=height*t;z=.055*math.sin(t*math.pi*1.4+phase)*wave
            width=.007+.083*wave**.8
            twist=.55*math.sin(t*math.pi*1.6+phase)
            row=[]
            for k in range(8):
                a=k*TAU/8;u=width*math.cos(a);v=.010*math.sin(a)*(1-.55*t)
                c=blend_color('#347f76','#91bea2',.18+.62*t+.12*math.sin(a))
                row.append(s.vertex((x+u*math.cos(twist)-v*math.sin(twist),y,z+u*math.sin(twist)+v*math.cos(twist)),c))
            rows.append(row)
        s.face(*reversed(rows[0]))
        for a,b in zip(rows,rows[1:]):
            for k in range(8):s.face(a[k],b[k],b[(k+1)%8],a[(k+1)%8])
        s.face(*rows[-1]);s.feature('cupped-swept-kelp',blade=blade,longitudinal_sections=24,thin_lenticular_section=True)
    s.sphere((0,.025,0),(.29,.045,.075),'#477e73',16,8)
    return s


def coral():
    s=Shape()
    s.sphere((0,-.07,0),(.40,.065,.105),'#d99d95',20,8,.04)
    for i,(x,height,lean) in enumerate([(-.29,.65,-.10),(0,.85,.025),(.28,.71,.09)]):
        points=[(x+lean*(j/12)**1.4,-.09+height*j/12,.012*math.sin(j*.40+i)) for j in range(13)]
        radii=[.064-.027*j/12 for j in range(13)]
        s.tube(points,radii,'#e8ac9c',12)
        s.sphere(points[-1],(.037,.040,.037),'#e8ac9c',16,10)
        for branch,(level,direction) in enumerate(((.37,-1),(.61,1))):
            start=(x+lean*level**1.4,-.09+height*level,.012*math.sin(level*4.8+i))
            reach=(.19 if branch==0 else .155)*direction
            points=[(start[0]+reach*math.sin(t*math.pi/2),start[1]+.17*t+.065*t*t,start[2]+.017*math.sin(t*math.pi+i)) for t in [j/8 for j in range(9)]]
            radii=[.047-.016*j/8 for j in range(9)]
            s.tube(points,radii,'#e8ac9c',12);s.sphere(points[-1],(.032,.036,.032),'#e8ac9c',16,10)
        s.feature('rounded-branching-coral',stalk=i,side_branches=2)
    s=fuse_organic(s,.012,3400)
    s.colors=[blend_color('#d78f91','#efbaa5',max(0,min(1,(v[1]+.12)/1.0))) for v in s.vertices]
    s.feature('continuous-fused-coral',single_connected_root=True,rounded_branch_transitions=True)
    return s


def fuse_organic(shape,voxel,target):
    mesh=bpy.data.meshes.new('temporary-organic-union');mesh.from_pydata(shape.vertices,[],shape.faces);mesh.update()
    # All overlapping closed inputs must face outward BEFORE voxel union;
    # inverted tip caps otherwise subtract cavities instead of joining roots.
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new('temporary-organic-union',mesh);bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    remesh=obj.modifiers.new('joined living branch roots','REMESH');remesh.mode='VOXEL';remesh.voxel_size=voxel;remesh.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=obj.modifiers.new('soft organic forks','SMOOTH');smooth.factor=.45;smooth.iterations=3;bpy.ops.object.modifier_apply(modifier=smooth.name)
    tri=obj.modifiers.new('triangulate authored union','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    if len(obj.data.polygons)>target:
        dec=obj.modifiers.new('local coral budget','DECIMATE');dec.ratio=target/len(obj.data.polygons);bpy.ops.object.modifier_apply(modifier=dec.name)
    result=Shape();result.features=list(shape.features)
    for v in obj.data.vertices:result.vertex(v.co,'#e5a798')
    for f in obj.data.polygons:result.face(*f.vertices)
    data=obj.data;old_name=mesh.name;data_name=data.name
    bpy.data.objects.remove(obj,do_unlink=True)
    for name in set((old_name,data_name)):
        block=bpy.data.meshes.get(name)
        if block is not None and block.users==0:bpy.data.meshes.remove(block)
    return result


def bubble_rock():
    s=Shape()
    s.sphere((0,.20,0),(.50,.27,.38),lambda p:blend_color('#7c9c9b','#b7c9b8',max(0,min(1,(p[1]+.05)/.58))),28,16,.045)
    s.feature('single-sculpted-rounded-stone',low_frequency_asymmetry=True,roughness_role='matte')
    s.role='satin'
    for i in range(4):
        center=(math.sin(i)*.15,.5+i*.3,0)
        s.torus(center,.080,.010,'#bce5df',28,8)
        s.tube([(center[0]-.052+.022*t,center[1]+.045+.021*math.sin(t*math.pi),.010) for t in (0,.25,.5,.75,1)],[.006,.007,.007,.006,.003],'#f1fff4',8)
    s.feature('airy-bubble-rings',count=4,small_curved_glints=True)
    return s


def chest():
    s = Shape(); s.role='wood'
    # Open trough, inset floor, and four-sided interior lip expose real depth.
    s.bevel_box((0, .055, 0), (.73, .09, .49), '#8d6448')
    for y,c in ((.12,'#a97850'),(.25,'#b38358'),(.38,'#b98b5d')):
        s.bevel_box((0,y,.22),(.73,.124,.060),c,.013)
    s.bevel_box((0, .25, -.22), (.73, .39, .055), '#9b704d')
    for x in (-.34, .34):
        s.bevel_box((x, .25, 0), (.065, .39, .44), '#a8764e')
    s.bevel_box((0, .11, 0), (.60, .025, .36), '#614f42', .007)
    s.role='satin'
    for z in (-.19, .19):
        s.bevel_box((0, .445, z), (.65, .025, .036), '#d3aa6a', .008)
    for x in (-.31, .31):
        s.bevel_box((x, .445, 0), (.035, .025, .38), '#d3aa6a', .008)
    # Barrel lid with inset end rings forming bevels, opened about the back hinge.
    s.role='wood'
    angle = math.radians(27)

    def lid_point(x, a, inset: float = 0):
        z = (.22 - inset) * math.cos(a)
        y = .465 + (.21 - inset) * math.sin(a)
        dy, dz = y - .465, z + .22
        return (x, .465 + dy * math.cos(angle) + dz * math.sin(angle),
                -.22 - dy * math.sin(angle) + dz * math.cos(angle))

    rows = []
    for x, inset in ((-.36, .016), (-.343, 0), (.343, 0), (.36, .016)):
        rows.append([s.vertex(lid_point(x, j * math.pi / 24, inset),
                              '#bc8e5e' if j % 4 else '#9c704e') for j in range(25)])
    for a, b in zip(rows, rows[1:]):
        for j in range(24):
            s.face(a[j], b[j], b[j + 1], a[j + 1])
        s.face(a[-1], b[-1], b[0], a[0])
    s.face(*reversed(rows[0]))
    s.face(*rows[-1])
    s.role='satin'
    # Bronze bands follow the lid curvature and continue down both body faces.
    for x in (-.235, .235):
        s.tube([lid_point(x, j * math.pi / 20, -.009) for j in range(21)], [.018] * 21, '#dfbc74', 6)
        s.bevel_box((x, .245, .253), (.048, .38, .018), '#d8b16b', .006)
        s.bevel_box((x, .245, -.253), (.048, .38, .018), '#c6a165', .006)
    s.bevel_box((0, .30, .272), (.10, .14, .045), '#eacb86', .020)
    s.bevel_box((0, .31, .296), (.018, .041, .008), '#695644', .003)
    for x in (-.23, .23):
        for y in (.11, .39):
            s.sphere((x, y, .27), (.012, .012, .009), '#f6d890', 8, 4)
    # Actual knuckles bridge the back wall and the lid; no floating top.
    for x in (-.30,.30):
        s.tube([(x-.05,.445,-.215),(x+.05,.445,-.215)],[.027,.027],'#c5a26e',12)
        s.bevel_box((x,.417,-.233),(.075,.09,.035),'#c7a773',.010)
        s.tube([(x,.445,-.215),lid_point(x,math.pi,.008)],[.025,.023],'#c7a773',12)
    s.feature('curved-beveled-barrel-lid', open_angle_degrees=27, profile_sections=24,attached_hinges=2)
    s.feature('hollow-interior', lip_sides=4, curved_bands=2,rounded_front_planks=3)
    return s


def star():
    s=Shape();segments,rings=96,16
    def surface(phi,a):
        wave=.5+.5*math.cos(5*(a-math.pi/2))
        radius=.19+.22*(wave*wave*(3-2*wave))
        return (radius*math.sin(phi)*math.cos(a),.37+radius*math.sin(phi)*math.sin(a),.095*math.cos(phi))
    first=s.vertex(surface(0,0),'#ffe5ad');rows=[]
    for j in range(1,rings):
        phi=math.pi*j/rings;row=[]
        for i in range(segments):
            a=i*TAU/segments;p=surface(phi,a)
            color=blend_color('#e5bb77','#ffe5ad',.35+.55*max(0,math.cos(phi)))
            row.append(s.vertex(p,color))
        rows.append(row)
    last=s.vertex(surface(math.pi,0),'#e5bb77')
    for i in range(segments):
        k=(i+1)%segments;s.face(first,rows[0][i],rows[0][k]);s.face(last,rows[-1][k],rows[-1][i])
    for a,b in zip(rows,rows[1:]):
        for i in range(segments):s.face(a[i],b[i],b[(i+1)%segments],a[(i+1)%segments])
    s.feature('puffed-rounded-seastar',arms=5,continuous_soft_rim=True,raised_noise_removed=True)
    return s


def food():
    s=Shape();s.role='wood'
    for i in range(5):
        center=((i%2-.5)*.11,i*.085,0);start=len(s.vertices)
        s.sphere(center,(.055,)*3,lambda p:blend_color('#a77448','#c79a63',.30+.35*(p[1]-center[1])/.055),16,10)
        # Rounded grain rather than a perfectly spherical bead; principal-axis
        # extrema and the five care centers remain exactly unchanged.
        for j in range(start,len(s.vertices)):
            q=[(s.vertices[j][k]-center[k])/.055 for k in range(3)]
            s.vertices[j]=tuple(center[k]+.055*math.copysign(abs(q[k])**.88,q[k]) for k in range(3))
        s.feature('pellet',center=list(center),radius=.055,soft_grain_exponent=.88)
    return s


def trail():
    s=Shape();s.role='satin'
    for i in range(5):
        center=(math.sin(i*1.6)*.3,i*.3,0);radius=.12+i%2*.07
        start=len(s.vertices);s.torus(center,radius,.014,'#b8e7e1',32,8)
        for j in range(start,len(s.vertices)):
            x,y,z=s.vertices[j];s.vertices[j]=(x,y,z*math.sin(math.pi*.4))
        # A small closed curved glint, still at the original highlight center.
        begin=len(s.vertices);glint=(center[0]-.055,center[1]+.07,.02)
        points=[(math.cos(a)*.020,math.sin(a)*.036,0) for a in [math.pi*.58+k*math.pi*.70/8 for k in range(9)]]
        s.tube(points,[.003,.006,.008,.009,.009,.008,.006,.004,.002],'#effff4',8)
        verts=s.vertices[begin:];lo=[min(p[k] for p in verts) for k in range(3)];hi=[max(p[k] for p in verts) for k in range(3)]
        for j in range(begin,len(s.vertices)):
            v=s.vertices[j];s.vertices[j]=tuple(glint[k]+((v[k]-lo[k])/(hi[k]-lo[k])-.5)*[.052,.08,.04][k] for k in range(3))
        s.feature('bubble-ring',center=list(center),major_radius=radius,tube_radius=.014,curved_glint=True)
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


def make_object(name, shape, materials, root):
    mesh = bpy.data.meshes.new(name + '-geometry')
    mesh.from_pydata([(x, -z, y) for x, y, z in shape.vertices], [], shape.faces)
    mesh.update()
    used=list(dict.fromkeys(shape.face_roles))
    for role in used:mesh.materials.append(materials[role])
    for face,role in zip(mesh.polygons,shape.face_roles):face.material_index=used.index(role)
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
    if name=='treasure-chest':
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
        mod=obj.modifiers.new('calm planar wood normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=40
        bpy.ops.object.modifier_apply(modifier=mod.name)
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
    roles = {'matte': make_material('english-matte', .80),
             'satin': make_material('english-satin', .36),
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
        make_object(name, shape, roles, root)
        features[name] = shape.features
    bpy.context.view_layer.objects.active = bpy.data.objects['shell-arch']
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.preferences.filepaths.file_preview_type='NONE'
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'props-english.blend'),compress=True)
    GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB',
                              export_yup=True, export_apply=True, export_animations=False,
                              export_cameras=False, export_lights=False,
                              export_texcoords=True, export_normals=True,
                              export_tangents=False, export_materials='EXPORT',
                              export_attributes=False, export_extras=False,
                              export_image_format='AUTO')
    validate = runpy.run_path(str(HERE / 'validate_props_english.py'))['validate']
    report = validate(GLB, HERE / 'baseline-bounds.json')
    report['blender_version'] = bpy.app.version_string
    report['source_geometry_features'] = features
    report['blend_bytes'] = (HERE / 'props-english.blend').stat().st_size
    report['source_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    report['blend_sha256'] = hashlib.sha256((HERE / 'props-english.blend').read_bytes()).hexdigest()
    (HERE / 'validation-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'triangles': report['triangles'],
                      'glb_bytes': report['glb_bytes'], 'parts': len(report['parts'])}))


if __name__ == '__main__':
    main()
