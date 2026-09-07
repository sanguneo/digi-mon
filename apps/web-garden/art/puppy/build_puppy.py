"""Original caramel puppy. Run with Blender --background --factory-startup --python this_file.

Authored coordinates are the app's Y-up/+Z-forward coordinates; P maps into Blender.
No source meshes, textures, add-ons, or network downloads are used.
"""
import json
import math
import struct
import sys
import tempfile
from collections.abc import Callable
from pathlib import Path
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
GLB = HERE.parent.parent / 'public/models/puppy.glb'
PREVIEW = ROOT / 'artifacts/puppy/contact-sheet.png'
PIVOTS = {'body': (0,0,0), 'head': (0,1.6,.5), 'tail': (0,1.03,-.94),
          'growth-collar': (0,0,0), 'growth-bandana': (0,0,0)}
CARAMEL, CREAM, DARK = '#be8855', '#f6dfb5', '#302923'

def P(p):
    return Vector((p[0],-p[2],p[1]))

def rgb(value):
    c = [int(value[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c)

def mix(a,b,t):
    return tuple(x*(1-t)+y*t for x,y in zip(a,b))

def smoothstep(a,b,x):
    t = min(1,max(0,(x-a)/(b-a)))
    return t*t*(3-2*t)

def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def apply(obj,mod):
    active(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)

def normals(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    for face in obj.data.polygons:
        face.use_smooth = True

def mesh(name,verts,faces):
    data = bpy.data.meshes.new(name)
    data.from_pydata([P(v) for v in verts],[],faces)
    data.update()
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    normals(obj)
    return obj

def ellipsoid(name,center,radii):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=P(center))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (radii[0],radii[2],radii[1])
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return obj

def join(name,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name
    return objects[0]

def catmull(rows,steps):
    rows = [np.array(row,dtype=float) for row in rows]
    result = []
    for i in range(len(rows)-1):
        a,b,c,d = rows[max(0,i-1)],rows[i],rows[i+1],rows[min(len(rows)-1,i+2)]
        for j in range(steps):
            t = j/steps
            result.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    return result+[rows[-1]]

def loft(name,sections,axis='z',steps=4,sides=32):
    # Anatomical cross-sections: center x,y,z and two transverse radii.
    rows = catmull(sections,steps)
    verts,faces = [],[]
    for x,y,z,r,s in rows:
        for j in range(sides):
            a = 2*math.pi*j/sides
            verts.append((x+r*math.cos(a),y+s*math.sin(a),z) if axis == 'z'
                         else (x+r*math.cos(a),y,z+s*math.sin(a)))
    for i in range(len(rows)-1):
        for j in range(sides):
            a,b = i*sides+j,i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple((len(rows)-1)*sides+j for j in range(sides))]
    return mesh(name,verts,faces)

def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)

def components(obj):
    adjacent = [set() for _ in obj.data.vertices]
    for edge in obj.data.edges:
        a,b = edge.vertices
        adjacent[a].add(b)
        adjacent[b].add(a)
    unseen,sizes = set(range(len(adjacent))),[]
    while unseen:
        todo,size = [unseen.pop()],0
        while todo:
            v = todo.pop()
            size += 1
            fresh = adjacent[v]&unseen
            unseen.difference_update(fresh)
            todo.extend(fresh)
        sizes.append(size)
    return sorted(sizes,reverse=True)

def decimate(obj,budget):
    count = triangles(obj)
    if count > budget:
        mod = obj.modifiers.new('Mobile silhouette budget','DECIMATE')
        mod.ratio = budget/count
        apply(obj,mod)

def sculpt(name,parts,voxel,budget):
    obj = join(name,parts)
    mod = obj.modifiers.new('Union anatomical volumes','REMESH')
    mod.mode = 'VOXEL'
    mod.voxel_size = voxel
    mod.use_smooth_shade = True
    apply(obj,mod)
    mod = obj.modifiers.new('Blend anatomical transitions','SMOOTH')
    mod.factor,mod.iterations = 1.25,6
    apply(obj,mod)
    decimate(obj,budget)
    normals(obj)
    assert len(components(obj)) == 1,(name,components(obj))
    return obj

def paint(obj,mat,color: str | Callable[[float,float,float],tuple[float,...]]):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    attr = obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for v,target in zip(obj.data.vertices,attr.data):
        x,z,y = v.co
        target.color = (*color(x,y,-z),1) if callable(color) else (*rgb(color),1)
    obj.data.color_attributes.active_color = attr
    obj.data.color_attributes.render_color_index = 0

def material(name,roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (1,1,1,1)
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Metallic'].default_value = 0
    vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'Color'
    mat.node_tree.links.new(vertex.outputs['Color'],principled.inputs['Base Color'])
    return mat

def tube(name,points,radius):
    curve = bpy.data.curves.new(name,'CURVE')
    curve.dimensions,curve.resolution_u = '3D',8
    curve.bevel_depth,curve.bevel_resolution = radius,2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for bp,p in zip(spline.bezier_points,points):
        bp.co = P(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    active(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object

def ear(side):
    # Closed thick pendant: a twisted sweep with a lip around its concave front.
    verts,faces = [],[]
    rows = catmull([(.53,2.14,.53,.065,.070),(.69,2.06,.56,.15,.10),
        (.79,1.84,.58,.17,.115),(.82,1.59,.64,.185,.12),(.80,1.35,.72,.175,.115),
        (.72,1.17,.77,.125,.08),(.66,1.12,.76,.02,.026)],4)
    sides = 24
    for i,(x,y,z,width,thick) in enumerate(rows):
        t = i/(len(rows)-1)
        for j in range(sides):
            a = 2*math.pi*j/sides
            u,front = math.cos(a),max(0,math.sin(a))
            fold = .072*(1-u*u)*front*math.sin(math.pi*t)
            verts.append((side*(x+width*u),y+.045*u*math.sin(math.pi*t),
                          z+thick*math.sin(a)-fold+.035*u*math.sin(math.pi*t)))
    for i in range(len(rows)-1):
        for j in range(sides):
            a,b = i*sides+j,i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple((len(rows)-1)*sides+j for j in range(sides))]
    obj = mesh('Folded pendant ear',verts,faces)
    mod = obj.modifiers.new('Soft continuous ear edge','SUBSURF')
    mod.levels = 1
    apply(obj,mod)
    decimate(obj,2200)
    def color(x,y,z):
        t = smoothstep(.70,.81,z)*(1-smoothstep(1.75,1.99,y))
        return mix(rgb('#95643f'),rgb('#c78973'),t*.75)
    paint(obj,FUR,color)
    return obj

def make_body():
    parts = [loft('Ribcage with tucked waist',[(0,.91,-1.02,.06,.07),
        (0,1.01,-.88,.40,.42),(0,1.09,-.56,.52,.51),(0,1.12,-.17,.53,.50),
        (0,1.15,.17,.49,.57),(0,1.13,.42,.37,.49),(0,1.14,.58,.08,.15)]),
        ellipsoid('Sloping neck overlap',(0,1.46,.36),(.43,.44,.39))]
    for s in (-1,1):
        parts += [ellipsoid('Scapula',(s*.38,1.09,.21),(.27,.43,.32)),
            ellipsoid('Haunch muscle',(s*.40,.84,-.66),(.33,.42,.37)),
            loft('Foreleg elbow wrist',[(s*.39,1.04,.31,.22,.23),
                (s*.43,.77,.34,.175,.18),(s*.43,.48,.40,.13,.15),
                (s*.43,.23,.47,.155,.18),(s*.43,.13,.54,.20,.23)],'y'),
            loft('Hindleg hock',[(s*.44,.80,-.68,.24,.25),(s*.49,.54,-.59,.18,.20),
                (s*.49,.30,-.74,.13,.14),(s*.49,.15,-.62,.19,.23)],'y')]
        for x,z in [(s*.43,.57),(s*.49,-.55)]:
            parts.append(ellipsoid('Weight bearing paw',(x,.14,z),(.235,.16,.305)))
            for dx in (-.12,0,.12):
                parts.append(ellipsoid('Integrated toe lobe',(x+dx,.115,z+.17),(.09,.105,.15)))
    obj = sculpt('Connected torso shoulders haunches limbs paws',parts,.027,10500)
    for v in obj.data.vertices:
        v.co.z = max(0,v.co.z)  # Actual flat contact patches on the Y=0 floor.
    def color(x,y,z):
        paw = 1-smoothstep(.20,.32,y)
        bib = math.exp(-((x/.32)**4+((y-1.0)/.48)**4))*smoothstep(.34,.52,z)
        return mix(rgb(CARAMEL),rgb(CREAM),max(paw,bib))
    paint(obj,FUR,color)
    return obj

def make_head():
    parts = [ellipsoid('Juvenile cranium',(0,1.84,.57),(.615,.57,.56)),
        ellipsoid('Occiput and neck seam',(0,1.58,.35),(.40,.33,.38)),
        ellipsoid('Nasal bridge stop',(0,1.76,1.00),(.29,.29,.33)),
        ellipsoid('Lower jaw',(0,1.43,1.04),(.33,.18,.33))]
    for s in (-1,1):
        parts += [ellipsoid('Zygomatic cheek',(s*.35,1.65,.87),(.285,.31,.31)),
            ellipsoid('Upper muzzle pad',(s*.155,1.58,1.15),(.25,.205,.30)),
            ellipsoid('Brow volume',(s*.28,2.055,.98),(.23,.14,.16))]
    skull = sculpt('Connected skull cheeks bridge muzzle jaw',parts,.020,12500)
    for s in (-1,1):
        cutter = ellipsoid('Socket cutter',(s*.295,1.96,1.084),(.174,.184,.132))
        mod = skull.modifiers.new('Recessed orbital socket','BOOLEAN')
        mod.operation,mod.object = 'DIFFERENCE',cutter
        apply(skull,mod)
        bpy.data.objects.remove(cutter,do_unlink=True)
    decimate(skull,10500)
    normals(skull)
    assert len(components(skull)) == 1
    def color(x,y,z):
        muzzle = (1-smoothstep(1.69,1.80,y))*smoothstep(.94,1.07,z)
        blaze = math.exp(-((x/.13)**4))*smoothstep(1.69,1.93,y)*(1-smoothstep(2.20,2.34,y))*smoothstep(.95,1.04,z)
        return mix(rgb(CARAMEL),rgb(CREAM),max(muzzle,blaze*.78))
    paint(skull,FUR,color)
    fur,details = [skull,ear(-1),ear(1)],[]
    for s in (-1,1):
        lid = tube('Upper eyelid',[(s*.14,1.97,1.106),(s*.20,2.075,1.094),
            (s*.32,2.105,1.072),(s*.43,2.045,1.041)],.029)
        paint(lid,FUR,'#8f603e')
        fur.append(lid)
        lid = tube('Lower eyelid',[(s*.16,1.925,1.114),(s*.28,1.827,1.105),(s*.405,1.895,1.062)],.017)
        paint(lid,FUR,'#ca9867')
        fur.append(lid)
        eye = ellipsoid('Inset eye',(s*.292,1.961,1.086),(.132,.148,.092))
        paint(eye,SATIN,DARK)
        details.append(eye)
        glint = ellipsoid('Eye catchlight',(s*.27,2.012,1.168),(.028,.035,.010))
        paint(glint,SATIN,'#fff4dd')
        details.append(glint)
        mouth = tube('Muzzle corner',[(0,1.477,1.402),(s*.12,1.454,1.389),
            (s*.245,1.49,1.347),(s*.30,1.54,1.297)],.012)
        paint(mouth,SATIN,'#684832')
        details.append(mouth)
    # Broad dorsal plane and tapered lower lobule: not another oval sphere.
    nose = mesh('Planed triangular nose',[(-.17,1.735,1.374),(.17,1.735,1.374),
        (.19,1.65,1.388),(.08,1.58,1.424),(-.08,1.58,1.424),(-.19,1.65,1.388),
        (-.14,1.72,1.46),(.14,1.72,1.46),(.145,1.665,1.481),
        (.055,1.615,1.49),(-.055,1.615,1.49),(-.145,1.665,1.481)],
        [(5,4,3,2,1,0),(6,7,8,9,10,11)]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)])
    mod = nose.modifiers.new('Soft edges preserve nose planes','BEVEL')
    mod.width,mod.segments = .027,3
    apply(nose,mod)
    normals(nose)
    paint(nose,SATIN,DARK)
    details.append(nose)
    lip = tube('Philtrum',[(0,1.605,1.453),(0,1.535,1.429),(0,1.477,1.402)],.01)
    paint(lip,SATIN,'#684832')
    details.append(lip)
    for s in (-1,1):
        nostril = ellipsoid('Nostril plane',(s*.115,1.667,1.478),(.039,.024,.009))
        paint(nostril,SATIN,'#151413')
        details.append(nostril)
    face = join('Eyes nose and lip details',details)
    decimate(face,4300)
    return join('Head fur and folded ears',fur),face

def make_tail():
    obj = loft('Tapered upward curling tail',[(0,1.04,-.89,.17,.17),
        (0,1.14,-1.03,.16,.16),(.025,1.31,-1.17,.14,.14),
        (.08,1.50,-1.26,.115,.115),(.14,1.64,-1.24,.075,.075),
        (.18,1.70,-1.17,.012,.012)],'y',steps=6,sides=20)
    mod = obj.modifiers.new('Continuous tail silhouette','SUBSURF')
    mod.levels = 1
    apply(obj,mod)
    decimate(obj,1800)
    paint(obj,FUR,lambda x,y,z: mix(rgb(CARAMEL),rgb(CREAM),smoothstep(1.48,1.61,y)))
    return obj

def finish(obj,frame):
    active(obj)
    normals(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.012)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.transform(Matrix.Translation(-frame.location))
    obj.parent = frame
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.location,obj.rotation_euler,obj.scale = (0,0,0),(0,0,0),(1,1,1)

def report_glb():
    raw = GLB.read_bytes()
    magic,version,size = struct.unpack_from('<III',raw)
    assert magic == 0x46546C67 and version == 2 and size == len(raw)
    length,kind = struct.unpack_from('<II',raw,12)
    assert kind == 0x4E4F534A
    doc = json.loads(raw[20:20+length])
    binary = raw[28+length:]
    nodes = {n['name']:n for n in doc['nodes']}
    root = nodes['puppy-asset']
    assert root.get('translation',[0,0,0]) == [0,0,0]
    assert root.get('rotation',[0,0,0,1]) == [0,0,0,1]
    assert root.get('scale',[1,1,1]) == [1,1,1]
    for name,p in PIVOTS.items():
        assert np.allclose(nodes[name].get('translation',[0,0,0]),p,atol=1e-6),nodes[name]
    assert not doc.get('images') and not doc.get('textures') and not doc.get('cameras')
    assert not doc.get('animations') and not doc.get('skins')
    assert all('uri' not in b for b in doc['buffers'])
    assert 'KHR_lights_punctual' not in doc.get('extensionsUsed',[])
    bounds,primitives = [np.full(3,np.inf),np.full(3,-np.inf)],[]
    def values(index,width=3):
        acc = doc['accessors'][index]
        view = doc['bufferViews'][acc['bufferView']]
        assert acc['componentType'] == 5126
        return np.ndarray((acc['count'],width),dtype='<f4',buffer=binary,
            offset=view.get('byteOffset',0)+acc.get('byteOffset',0),strides=(view.get('byteStride',width*4),4))
    def visit(index,parent):
        node = doc['nodes'][index]
        assert 'matrix' not in node and 'rotation' not in node and 'scale' not in node,node
        offset = parent+np.array(node.get('translation',[0,0,0]))
        if 'mesh' in node:
            for prim in doc['meshes'][node['mesh']]['primitives']:
                assert prim.get('mode',4) == 4
                assert {'POSITION','NORMAL','TEXCOORD_0','COLOR_0'} <= prim['attributes'].keys()
                verts = values(prim['attributes']['POSITION'])+offset
                assert np.isfinite(verts).all()
                normal = values(prim['attributes']['NORMAL'])
                uv = values(prim['attributes']['TEXCOORD_0'],2)
                assert np.isfinite(normal).all() and np.isfinite(uv).all()
                assert np.allclose(np.linalg.norm(normal,axis=1),1,atol=.001)
                assert np.all(np.ptp(uv,axis=0) > .1)
                bounds[0] = np.minimum(bounds[0],verts.min(axis=0))
                bounds[1] = np.maximum(bounds[1],verts.max(axis=0))
                count = doc['accessors'][prim['indices']]['count']//3
                primitives.append({'node':node['name'],'triangles':count,'vertices':len(verts)})
        for child in node.get('children',[]):
            visit(child,offset)
    for node in doc['scenes'][doc.get('scene',0)]['nodes']:
        visit(node,np.zeros(3))
    total = sum(p['triangles'] for p in primitives)
    assert 15000 <= total <= 45000,total
    assert len(primitives) == 6 and len(doc['materials']) == 3
    assert len(raw) < 3_000_000
    assert abs(bounds[0][1]) < 1e-6,bounds
    dims = bounds[1]-bounds[0]
    assert 1.6 < dims[0] < 2.1 and 2.2 < dims[1] < 2.6 and 2.5 < dims[2] < 3.1,dims
    result = {'blender_version':bpy.app.version_string,
        'command':f'"{bpy.app.binary_path}" --background --factory-startup --threads 8 --python apps/web-garden/art/puppy/build_puppy.py',
        'glb_bytes':len(raw),'triangles':total,'mesh_primitives':len(primitives),
        'materials':[{'name':m['name'],'roughness':m['pbrMetallicRoughness']['roughnessFactor']} for m in doc['materials']],
        'bounds_y_up':{'min':bounds[0].tolist(),'max':bounds[1].tolist(),'dimensions':dims.tolist()},
        'pivots_y_up':PIVOTS,'primitives':primitives,'textures':0,'images':0,
        'color_encoding':'linear COLOR_0 vertex colors, white base color factor',
        'attributes':['POSITION','NORMAL','TEXCOORD_0','COLOR_0'],
        'connected_body_components':BODY_COMPONENTS,'connected_primary_skull_components':1,
        'preview':PREVIEW.relative_to(ROOT).as_posix(),'preview_views':['front','side','three-quarter'],
        'provenance':'Original authored anatomical cross-sections and sculpt volumes; no downloaded models or textures',
        'checks':'GLB header, embedded buffer, hierarchy/pivots, identity transforms, bounds, geometry budget, finite attributes, unit normals, noncollapsed UVs, no cameras/lights/images/animations'}
    (HERE/'asset-report.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print('PUPPY_ASSET_REPORT '+json.dumps(result))

def preview():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples,scene.cycles.use_denoising = 20,True
    scene.render.threads_mode,scene.render.threads = 'FIXED',8
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.world.color = (.32,.32,.32)
    scene.view_settings.view_transform = 'AgX'
    for name,position,power,size in [('Key',(-3,6,4),450,4),('Fill',(4,3,2),220,3),('Rim',(1,4,-4),380,3)]:
        data = bpy.data.lights.new(name,'AREA')
        data.energy,data.shape,data.size = power,'DISK',size
        obj = bpy.data.objects.new(name,data)
        scene.collection.objects.link(obj)
        obj.location = P(position)
        obj.rotation_euler = (P((0,1,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200)
    floor = bpy.context.object
    floor.name = 'Preview floor - not exported'
    mat = bpy.data.materials.new('Preview neutral backdrop')
    mat.diffuse_color = (.27,.30,.28,1)
    floor.data.materials.append(mat)
    data = bpy.data.cameras.new('Preview camera - not exported')
    camera = bpy.data.objects.new('Preview camera - not exported',data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    data.type,data.ortho_scale = 'ORTHO',3.35
    frames = []
    # Background Blender exposes no Render Result pixels; reload linear EXR data.
    with tempfile.TemporaryDirectory(prefix='puppy-preview-') as temp:
        scene.render.image_settings.file_format = 'OPEN_EXR'
        for position in [(0,2.5,7),(7,2.5,0),(5,3.1,6)]:
            camera.location = P(position)
            camera.rotation_euler = (P((0,1.2,.05))-camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath = str(Path(temp)/'view.exr')
            bpy.ops.render.render(write_still=True)
            image = bpy.data.images.load(scene.render.filepath,check_existing=False)
            pixels = np.empty(512*512*4,dtype=np.float32)
            image.pixels.foreach_get(pixels)
            frames.append(pixels.reshape(512,512,4))
            bpy.data.images.remove(image)
    scene.render.image_settings.file_format = 'PNG'
    sheet = bpy.data.images.new('Front - Side - Three-quarter',width=1536,height=512,alpha=True,float_buffer=True)
    sheet.pixels.foreach_set(np.concatenate(frames,axis=1).ravel())
    PREVIEW.parent.mkdir(parents=True,exist_ok=True)
    sheet.file_format = 'PNG'
    sheet.save_render(str(PREVIEW),scene=scene)
    bpy.data.images.remove(sheet)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'puppy.blend'),compress=True)

def main():
    global FUR,SATIN,CLOTH,BODY_COMPONENTS
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    FUR,SATIN,CLOTH = material('Puppy matte fur',.86),material('Puppy satin face',.34),material('Puppy woven accessories',.93)
    root = bpy.data.objects.new('puppy-asset',None)
    bpy.context.collection.objects.link(root)
    frames = {}
    for name,pivot in PIVOTS.items():
        frame = bpy.data.objects.new(name,None)
        bpy.context.collection.objects.link(frame)
        frame.parent,frame.location = root,P(pivot)
        frames[name] = frame
    body = make_body()
    BODY_COMPONENTS = len(components(body))
    head,face = make_head()
    tail = make_tail()
    points = [(.40*math.cos(a),1.32,.39+.36*math.sin(a)) for a in np.linspace(0,2*math.pi,17)]
    collar = tube('Soft teal woven collar',points,.055)
    paint(collar,CLOTH,'#6a9c9b')
    bandana = mesh('Draped kerchief',[(-.27,1.30,.74),(-.13,1.30,.795),(0,1.30,.82),(.13,1.30,.795),(.27,1.30,.74),
        (-.135,1.12,.78),(0,1.10,.865),(.135,1.12,.78),(0,.87,.77)],
        [(0,1,6,5),(1,2,6),(2,3,7,6),(3,4,7),(5,6,8),(6,7,8)])
    mod = bandana.modifiers.new('Actual cloth thickness','SOLIDIFY')
    mod.thickness = .026
    apply(bandana,mod)
    mod = bandana.modifiers.new('Rounded hem','BEVEL')
    mod.width,mod.segments = .018,3
    apply(bandana,mod)
    paint(bandana,CLOTH,'#d88c73')
    objects = [(body,'body'),(head,'head'),(face,'head'),(tail,'tail'),(collar,'growth-collar'),(bandana,'growth-bandana')]
    for obj,name in objects:
        finish(obj,frames[name])
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root,*frames.values(),*[o for o,n in objects]]:
        obj.select_set(True)
    GLB.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,
        export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,
        export_materials='EXPORT',export_animations=False,export_cameras=False,export_lights=False)
    report_glb()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'puppy.blend'),compress=True)
    if '--no-preview' not in sys.argv:
        preview()

if __name__ == '__main__':
    main()
