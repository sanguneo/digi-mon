"""Original curved miniature environments. Blender4.3+, no external assets.

Y-up design coordinates; named identity parts are independently cloned by runtime.
The editable scene retains individually named features. Only per-role duplicates
are consolidated for export. Geometry is designed, not blanket-subdivided.
"""
from pathlib import Path
import math,json,hashlib
import bpy,bmesh
from mathutils import Vector
HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'public/models'
TAU=math.tau

def xyz(p):return (p[0],-p[2],p[1])
def linear(c):
 r=[int(c[i:i+2],16)/255 for i in (1,3,5)]
 return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in r)+(1,)
def empty(name,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o

def material(name,roughness,alpha=1):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(1,1,1,1);b.inputs['Roughness'].default_value=roughness;b.inputs['Metallic'].default_value=0;b.inputs['Alpha'].default_value=alpha
 n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Color';m.node_tree.links.new(n.outputs['Color'],b.inputs['Base Color'])
 if alpha<1:m.surface_render_method='DITHERED';m.use_transparency_overlap=False
 return m

def mesh(part,name,verts,faces,color,role='organic',smooth=True,bevel=0):
 d=bpy.data.meshes.new(name);d.from_pydata([xyz(v) for v in verts],[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.parent=PARTS[part]
 if bevel:
  bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Small crafted edge radius','BEVEL');m.width=bevel;m.segments=3;bpy.ops.object.modifier_apply(modifier=m.name)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update();o.data.materials.append(MATS[role])
 c=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER');uv=o.data.uv_layers.new(name='UVMap');c=o.data.color_attributes['Color'];uv=o.data.uv_layers['UVMap']
 for f in o.data.polygons:
  f.use_smooth=smooth
  for li in f.loop_indices:
   p=o.data.vertices[o.data.loops[li].vertex_index].co;design=(p.x,p.z,-p.y);c.data[li].color=linear(color(design) if callable(color) else color);uv.data[li].uv=(p.x/10+.5,p.y/10+.5)
 o.data.color_attributes.active_color=c;o.data.color_attributes.render_color_index=0;o['feature']=name;o['surface']=role;FEATURES[part].append(o);return o

def box(part,name,center,size,color,bevel=.03,role='wood'):
 s=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
 v=[tuple(center[a]+size[a]*p[a]/2 for a in range(3)) for p in s]
 return mesh(part,name,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],color,role,False,bevel)

def tube(part,name,points,radii,color,sides=8,role='organic'):
 ps=[Vector(p) for p in points];v=[];f=[]
 for i,p in enumerate(ps):
  tangent=(ps[min(i+1,len(ps)-1)]-ps[max(0,i-1)]).normalized();ref=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((1,0,0));u=tangent.cross(ref).normalized();w=tangent.cross(u).normalized();r=radii[i] if isinstance(radii,list) else radii
  for j in range(sides):v.append(tuple(p+r*(math.cos(j*TAU/sides)*u+math.sin(j*TAU/sides)*w)))
 for i in range(len(ps)-1):
  for j in range(sides):k=(j+1)%sides;f.append((i*sides+j,i*sides+k,(i+1)*sides+k,(i+1)*sides+j))
 f.extend([tuple(reversed(range(sides))),tuple((len(ps)-1)*sides+j for j in range(sides))]);return mesh(part,name,v,f,color,role)

def oval(part,name,center,radii,color,n=18,rings=8,role='organic',distort=0):
 v=[(center[0],center[1]+radii[1],center[2])];f=[]
 for j in range(1,rings):
  a=math.pi*j/rings
  for i in range(n):
   b=TAU*i/n;q=1+distort*(.65*math.sin(3*b+.8)+.35*math.cos(5*b))
   v.append((center[0]+radii[0]*math.sin(a)*math.cos(b)*q,center[1]+radii[1]*math.cos(a),center[2]+radii[2]*math.sin(a)*math.sin(b)*q))
 bottom=len(v);v.append((center[0],center[1]-radii[1],center[2]))
 for i in range(n):
  k=(i+1)%n;f.extend([(0,1+i,1+k),(bottom,1+(rings-2)*n+k,1+(rings-2)*n+i)])
  for j in range(rings-2):f.append((1+j*n+i,1+(j+1)*n+i,1+(j+1)*n+k,1+j*n+k))
 return mesh(part,name,v,f,color,role)

def leaf(part,name,start,end,width,color,curl=.1,n=10,sections=4,roundness=.72):
 a,b=Vector(start),Vector(end);axis=b-a;side=axis.cross(Vector((0,0,1))).normalized()
 if side.length<.1:side=Vector((1,0,0))
 normal=side.cross(axis).normalized();v=[];f=[]
 for lower in (False,True):
  for i in range(n+1):
   t=i/n;center=a+axis*t+normal*(curl*math.sin(math.pi*t)+.035*t*t);half=width*max(.012,math.sin(math.pi*t)**roundness)*(1-.24*t)
   for j in range(sections+1):
    w=2*j/sections-1;p=center+side*(half*w)+normal*((1-w*w)*width*.23*math.sin(math.pi*t)+(-.006 if lower else .006));v.append(tuple(p))
 row=sections+1;stride=(n+1)*row
 for k in range(2):
  off=k*stride
  for i in range(n):
   for j in range(sections):q=off+i*row+j;face=(q,q+1,q+row+1,q+row);f.append(tuple(reversed(face)) if k else face)
 for j in range(row-1):f.extend([(j,j+stride,j+stride+1,j+1),(n*row+j,n*row+j+1,n*row+j+stride+1,n*row+j+stride)])
 for i in range(n):
  for j in (0,sections):q=i*row+j;f.append((q,q+row,q+row+stride,q+stride))
 return mesh(part,name,v,f,color)

def flower(part,name,x,z,height,color):
 points=[(x+.03*math.sin(i*.32),.08+height*i/8,z-.06*(i/8)**2) for i in range(9)]
 tube(part,name+'-bending-stalk',points,[.018*(1-.4*i/8) for i in range(9)],'#5e9565',6)
 c=Vector(points[-1]);c.z+=.015
 for k in range(5):
  t=k*TAU/5;end=c+Vector((math.cos(t)*.18,math.sin(t)*.18,.025));leaf(part,name+f'-petal-{k}',tuple(c),tuple(end),.095,color,-.016,7,4,.5)
 oval(part,name+'-pollen',tuple(c+Vector((0,0,.025))),(.064,.064,.035),'#e8b85a',16,7)
 leaf(part,name+'-leaf',(x,.19,z),(x-.18,.29,z+.015),.07,'#6b9c65',.025,7,4)

def ground(part):
 v=[];f=[];n=96
 profile=[(4.61,-.74),(4.76,-.70),(4.83,-.58),(4.86,-.17),(4.87,-.035),(4.82,.04),(4.70,.065),(3.7,.065)]
 for r,y in profile:
  for i in range(n):
   t=TAU*i/n;wave=1+.006*math.sin(3*t+.4)+.004*math.cos(5*t);v.append((r*wave*math.cos(t),y,r*wave*math.sin(t)))
 for j in range(len(profile)-1):
  for i in range(n):k=(i+1)%n;f.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
 v.append((0,.065,0));center=len(v)-1
 for i in range(n):f.append(((len(profile)-1)*n+i,(len(profile)-1)*n+(i+1)%n,center))
 f.append(tuple(reversed(range(n))))
 mesh(part,'continuous-rounded-turf-earth',v,f,lambda p:'#a9bf87' if p[1]>=-.035 else '#ad8d65')
 # Sparse low swept clover, replacing disconnected flattened sphere mounds.
 for k in range(8):
  t=k*TAU/8;x,z=4.13*math.cos(t),4.13*math.sin(t)
  for j in range(4):
   a=t+j*2.1;leaf(part,f'edge-clover-{k}-{j}',(x,.075,z),(x+.31*math.cos(a),.11+(j%2)*.055,z+.24*math.sin(a)),.10,['#7ca164','#83ac6a','#91b778'][j%3],.045,7,4)
 # Rounded weathered stepping stones: asymmetric low-frequency perimeter, not pillows.
 for k in range(7):
  x,z=1.1+math.sin(k*.5)*.55,2.9-k*.75
  oval(part,f'worn-stone-{k}',(x,.09,z),(.31,.045,.215),'#e3d1ac',22,7,distort=.07)
 for k in range(6):flower(part,f'meadow-flower-{k}',-3.4+k*.35,1.4+(k%2)*.4,.30+(k%3)*.028,'#eebda5' if k%2 else '#f2d698')
 # Round-topped wooden pickets and slightly bowed, joint-overlapping rails.
 for k in range(9):
  x=-3.6+k*.9
  tube(part,f'rounded-picket-{k}',[(x,.06,-2.9),(x,.12,-2.9),(x,.60,-2.9),(x,.67,-2.9),(x,.695,-2.9)],[.045,.06,.06,.053,.012],'#d4bf98',12,'wood')
 for y in (.29,.52):
  points=[(-3.64+7.28*i/32,y-.023*math.sin(i*math.pi/4)**2,-2.89) for i in range(33)]
  tube(part,f'curved-fence-rail-{y}',points,.037,'#d6c5a0',8,'wood')

def sprig(part,aquatic=False):
 if aquatic:
  # Upright ribbon rosette: no land-plant side-leaf ladder in the aquarium.
  for k in range(3):
   base=Vector(((k-1)*.075,.01,(k%2)*.06));height=[.88,1.12,.98][k];v=[];f=[];n=14;wseg=4
   for lower in (False,True):
    for i in range(n+1):
     t=i/n;cx=base.x+(k-1)*.14*t+.085*math.sin(t*TAU+k*.8)*t;cz=base.z+.09*math.sin(t*math.pi+k*.7)*t;half=.072*max(.015,math.sin(math.pi*t)**.5)*(1-.24*t);twist=.24*math.sin(t*TAU+k)
     for j in range(wseg+1):
      w=2*j/wseg-1;v.append((cx+half*w*math.cos(twist),.02+height*t,cz+half*w*math.sin(twist)+.015*(1-w*w)*math.sin(math.pi*t)+(-.004 if lower else .004)))
   row=wseg+1;stride=(n+1)*row
   for layer in range(2):
    off=layer*stride
    for i in range(n):
     for j in range(wseg):q=off+i*row+j;face=(q,q+1,q+row+1,q+row);f.append(tuple(reversed(face)) if layer else face)
   for i in range(n):
    for j in (0,wseg):q=i*row+j;f.append((q,q+row,q+row+stride,q+stride))
   for j in range(wseg):f.extend([(j,j+stride,j+stride+1,j+1),(n*row+j,n*row+j+1,n*row+j+stride+1,n*row+j+stride)])
   mesh(part,f'rooted-swaying-ribbon-{k}',v,f,['#609b87','#71ac94','#4f8a7b'][k])
  return
 color='#5b9b87' if aquatic else '#6f9e61'
 # Stem and all leaf roots overlap on one intentional curved centerline.
 ps=[(.075*math.sin(i/12*1.8),i/12,.04*(i/12)**2) for i in range(13)]
 tube(part,'flexing-continuous-stem',ps,[.025*(1-.75*i/12) for i in range(13)],'#598d69' if not aquatic else '#568e7d',7)
 for k,t in enumerate([.25,.43,.61,.78]):
  side=(-1 if k%2 else 1);x=.075*math.sin(t*1.8);z=.04*t*t
  if aquatic:
   leaf(part,f'flowing-aquatic-blade-{k}',(x,t,z),(x+side*(.29-.03*k),t+.30,z+.06),.084,color,.07,12,4)
  else:leaf(part,f'soft-garden-leaf-{k}',(x,t,z),(x+side*.31,t+.20,z+.025),.12,color,.065,10,4)
 leaf(part,'young-apical-leaf',ps[-3],(.10,1.12,.06),.075,color,.035,9,4)

def aquarium(part):
 box(part,'rounded-aquarium-plinth',(0,-.35,0),(8.9,.65,6.4),'#71a5a5',.13,'wood')
 box(part,'soft-sand-bed',(0,-.005,0),(8.55,.16,6.1),'#e8d1a1',.065,'organic')
 # Bare front remains a clean viewing aperture: no front glass or top front rail.
 for x in (-4.3,4.3):
  for z in (-3.05,3.05):box(part,f'soft-corner-{x}-{z}',(x,2.1,z),(.065,4.25,.065),'#b4d9ce',.025,'wood')
 for y in (0,4.2):
  for x in (-4.3,4.3):box(part,f'side-edge-{x}-{y}',(x,y,0),(.075,.075,6.15),'#b4d9ce',.026,'wood')
  for z in ((-3.05,3.05) if y==0 else (-3.05,)):box(part,f'back-edge-{z}-{y}',(0,y,z),(8.65,.055,.055),'#9bc6bd',.02,'wood')
 # Three panes consolidated in one translucent submission; remain double-sided.
 for x in (-4.3,4.3):mesh(part,f'glass-side-{x}',[(x,0,-3.05),(x,4.2,-3.05),(x,4.2,3.05),(x,0,3.05)],[(0,1,2,3)],'#8bbeb7','glass',False)
 mesh(part,'glass-back',[(-4.3,0,-3.05),(4.3,0,-3.05),(4.3,4.2,-3.05),(-4.3,4.2,-3.05)],[(0,1,2,3)],'#8bbeb7','glass',False)
 tube(part,'quiet-back-waterline',[(-4.15+i*8.3/24,3.85+.012*math.sin(i*.7),-3.0) for i in range(25)],.014,'#d2e5d5',6,'organic')
 for k in range(11):
  x=-3.7+k*.70;z=-2.65+.12*math.sin(k*1.9)
  oval(part,f'rear-river-pebble-{k}',(x,.10,z),(.11+.025*(k%3),.065,.09),'#b6b9a0' if k%2 else '#d5c7a5',14,6,distort=.06)

def build(subject):
 global PARTS,FEATURES,MATS
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for m in list(bpy.data.materials):bpy.data.materials.remove(m)
 root=empty(f'{subject}-environment');root['authored']='original Blender curved supporting environment v1'
 ids=['static-environment']+(['aquatic-sprig'] if subject=='english' else ['garden-sprig'] if subject=='korean' else [])+(['watering-drops'] if subject=='korean' else [])
 PARTS={name:empty(name,root) for name in ids};FEATURES={name:[] for name in ids}
 MATS={'organic':material('Environment organic',.88),'wood':material('Environment dry-crafted',.8)}
 if subject=='english':MATS['glass']=material('Environment glass',.18,.14)
 if subject=='english':aquarium('static-environment');sprig('aquatic-sprig',True)
 else:
  ground('static-environment')
  if subject=='korean':
   sprig('garden-sprig')
   for i in range(7):oval('watering-drops',f'tapered-droplet-{i}',(-.85+i%3*.17,.20+i*.12,.55),(.036,.073,.036),'#72b7c9',12,7)
 bpy.context.view_layer.update();bpy.context.preferences.filepaths.save_version=0;bpy.context.preferences.filepaths.file_preview_type='NONE'
 bpy.ops.wm.save_as_mainfile(filepath=str(HERE/f'environment-{subject}.blend'),compress=True)
 exported=[root]+list(PARTS.values());summary={}
 for name,objects in FEATURES.items():
  summary[name]={'triangles':sum(len(o.data.polygons) for o in objects),'features':len(objects)}
  for role in MATS:
   originals=[o for o in objects if o['surface']==role]
   if not originals:continue
   bpy.ops.object.select_all(action='DESELECT');copies=[]
   for o in originals:
    c=o.copy();c.data=o.data.copy();bpy.context.collection.objects.link(c);c.select_set(True);copies.append(c)
   bpy.context.view_layer.objects.active=copies[0]
   if len(copies)>1:bpy.ops.object.join()
   c=bpy.context.object;c.name=f'{name}-{role}';exported.append(c)
 bpy.ops.object.select_all(action='DESELECT')
 for o in exported:o.select_set(True)
 path=OUT/f'environment-{subject}.glb';OUT.mkdir(exist_ok=True,parents=True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_vertex_color='ACTIVE',export_animations=False,export_cameras=False,export_lights=False,export_image_format='NONE',export_extras=True)
 triangles=sum(v['triangles'] for v in summary.values());assert triangles<=22000,(subject,triangles);assert path.stat().st_size<=1500000
 return {'subject':subject,'parts':summary,'triangles':triangles,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
if __name__=='__main__':
 report=[build(s) for s in ['korean','english','math']];(HERE/'asset-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
