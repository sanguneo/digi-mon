"""Original curved storybook Korean garden props, with matched Cycles visual QA.

Blender --background --factory-startup --python <this file>
python <this file> --verify-only
Design coordinates are Y-up; vertices, never object transforms, carry geometry.
"""
from pathlib import Path
import json
import math
import sys

HERE = Path(__file__).resolve().parent
GLB = HERE.parents[1] / 'public/models/props-korean.glb'
BLEND = HERE / 'props-korean.blend'
BASELINE = json.loads((HERE / 'baseline-bounds.json').read_text())['bounds']
IDS = tuple(BASELINE)
TAU = math.tau
CREAM, WOOD, GREEN, TEAL = '#fff0d3', '#ac7953', '#83aa78', '#699eae'
PARTS, FEATURES = {}, {}


def xyz(p):
    return (p[0], -p[2], p[1])


def yup(p):
    return (p[0], p[2], -p[1])


def color_linear(c):
    rgb = [int(c[i:i+2], 16)/255 for i in (1, 3, 5)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)


def empty(name, parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    return ob


def finish(ob, part, color, role='matte', smooth=True):
    ob.parent = PARTS[part]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    ob.data.materials.append(MATERIALS[role])
    ob.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    ob.data.uv_layers.new(name='UVMap')
    # Blender 4.3 may reallocate CustomData while adding either layer. Do not
    # retain an RNA layer handle across creation of another layer.
    col = ob.data.color_attributes['Color']
    uv = ob.data.uv_layers['UVMap']
    for face in ob.data.polygons:
        face.use_smooth = smooth
        axes = [i for i in range(3) if i != max(range(3), key=lambda i: abs(face.normal[i]))]
        for li in face.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv.data[li].uv = ((p[axes[0]]+2)/4, (p[axes[1]]+2)/4)
            value=color(yup(p)) if callable(color) else color
            col.data[li].color = color_linear(value) if isinstance(value,str) else (*value,1)
    ob.data.color_attributes.active_color = col
    ob.data.color_attributes.render_color_index = 0
    ob['feature'] = ob.name
    ob['surface'] = role
    FEATURES[part].append(ob)
    return ob


def mesh(part, name, verts, faces, color, role='matte', smooth=True, bevel: float=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(p) for p in verts], [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    if bevel:
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new('Soft crafted edges', 'BEVEL')
        mod.width, mod.segments = bevel, 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    result = finish(ob, part, color, role, smooth or bool(bevel))
    if bevel:
        bpy.context.view_layer.objects.active = ob
        weighted = ob.modifiers.new('Crafted planar faces and soft bevel normals', 'WEIGHTED_NORMAL')
        weighted.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=weighted.name)
    return result


def box(part, name, center, size, color, bevel=.012):
    v = [tuple(center[a]+size[a]*s[a]/2 for a in range(3))
         for s in [(-1,-1,-1), (1,-1,-1), (1,1,-1), (-1,1,-1),
                   (-1,-1,1), (1,-1,1), (1,1,1), (-1,1,1)]]
    return mesh(part, name, v, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],
                color, smooth=False, bevel=bevel)


def lathe(part, name, profile, color, role='matte', n=32, center=(0,0,0), sx: float=1, sz: float=1, shape=None):
    verts, rows, faces = [], [], []
    for r, y in profile:
        if r == 0:
            rows.append([len(verts)])
            verts.append((center[0], center[1]+y, center[2]))
        else:
            rows.append(list(range(len(verts), len(verts)+n)))
            for j in range(n):
                a = TAU*j/n
                f = shape(a) if shape else 1
                verts.append((center[0]+sx*r*f*math.cos(a), center[1]+y, center[2]+sz*r*f*math.sin(a)))
    for a,b in zip(rows, rows[1:]):
        for j in range(n):
            k = (j+1)%n
            if len(a)==1:
                faces.append((a[0],b[k],b[j]))
            elif len(b)==1:
                faces.append((a[j],a[k],b[0]))
            else:
                faces.append((a[j],a[k],b[k],b[j]))
    return mesh(part,name,verts,faces,color,role)


def orb(part,name,c,r,color,role='matte',n=16,rings=8):
    profile = [(0,-1)]+[(math.cos(-math.pi/2+math.pi*i/rings), math.sin(-math.pi/2+math.pi*i/rings)) for i in range(1,rings)]+[(0,1)]
    return lathe(part,name,[(v*r[0],y*r[1]) for v,y in profile],color,role,n,c,sz=r[2]/r[0])


def tube(part,name,points,r,color,role='matte',sides=6,closed=False):
    pts = [Vector(p) for p in points]
    verts,faces = [],[]
    for i,p in enumerate(pts):
        before = pts[(i-1)%len(pts)] if closed else pts[max(0,i-1)]
        after = pts[(i+1)%len(pts)] if closed else pts[min(len(pts)-1,i+1)]
        t = (after-before).normalized()
        side = t.cross(Vector((0,0,1)) if abs(t.z)<.85 else Vector((1,0,0))).normalized()
        up = t.cross(side).normalized()
        rad = r(i/(len(pts)-1)) if callable(r) else r
        verts.extend(tuple(p+rad*(side*math.cos(TAU*j/sides)+up*math.sin(TAU*j/sides))) for j in range(sides))
    for i in range(len(pts) if closed else len(pts)-1):
        for j in range(sides):
            a,b=i*sides,((i+1)%len(pts))*sides
            faces.append((a+j,a+(j+1)%sides,b+(j+1)%sides,b+j))
    if not closed:
        faces.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))])
    return mesh(part,name,verts,faces,color,role)


def ring(part,name,c,rx,rz,r,color,vertical=False,n=32,sides=6,role='matte'):
    return tube(part,name,[(c[0]+rx*math.cos(TAU*j/n), c[1]+(rz*math.sin(TAU*j/n) if vertical else 0),
                           c[2]+(0 if vertical else rz*math.sin(TAU*j/n))) for j in range(n)],r,color,role,sides,True)


def curved_points(points, steps=4, closed=False):
    """Centrally controlled Catmull-Rom paths, not subdivided straight tubes."""
    p=[Vector(v) for v in points]
    result=[]
    for i in range(len(p) if closed else len(p)-1):
        a,b,c,d=(p[(i-1)%len(p)] if closed else p[max(0,i-1)], p[i],
                 p[(i+1)%len(p)], p[(i+2)%len(p)] if closed else p[min(len(p)-1,i+2)])
        for j in range(steps):
            t=j/steps
            result.append(tuple(.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)))
    if not closed:
        result.append(tuple(p[-1]))
    return result


def petal(part,name,start,end,width,color,rows=4):
    """Closed cupped blade with a curved centerline and rounded lenticular edge."""
    a,b=Vector(start),Vector(end)
    d=b-a
    side=d.cross(Vector((0,0,1)) if abs(d.normalized().z)<.8 else Vector((0,1,0))).normalized()
    normal=d.normalized().cross(side).normalized()
    vertices=[tuple(a)]; loops=[[0]]; faces=[]
    for i in range(1,rows+1):
        t=i/(rows+1)
        profile=math.sin(math.pi*t)**.8
        center=a+d*t+normal*(math.sin(math.pi*t)*width*.22+t*t*width*.18)
        loops.append(list(range(len(vertices),len(vertices)+6)))
        for j in range(6):
            angle=TAU*j/6
            vertices.append(tuple(center+side*(width*profile*math.cos(angle))+normal*(max(.004,width*.11)*profile*math.sin(angle))))
    loops.append([len(vertices)]); vertices.append(tuple(b+normal*width*.18))
    for left,right in zip(loops,loops[1:]):
        for j in range(6):
            k=(j+1)%6
            faces.append((left[0],right[k],right[j]) if len(left)==1 else
                         (left[j],left[k],right[0]) if len(right)==1 else (left[j],left[k],right[k],right[j]))
    return mesh(part,name,vertices,faces,color)


def raw_volume(name,center,radii,segments=28,rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings)
    obj=bpy.context.object; obj.name=name
    for v in obj.data.vertices:
        q=yup(v.co)
        v.co=xyz(tuple(center[i]+q[i]*radii[i] for i in range(3)))
    return obj


def unified(part,name,objects,color,budget=2600,voxel=.012):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join(); obj=objects[0]; obj.name=name
    remesh=obj.modifiers.new('Continuous organic junctions','REMESH')
    remesh.mode='VOXEL'; remesh.voxel_size=voxel; remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    relax=obj.modifiers.new('Soft sculpted curvature','SMOOTH'); relax.factor=.8; relax.iterations=6
    bpy.ops.object.modifier_apply(modifier=relax.name)
    obj.data.calc_loop_triangles()
    if len(obj.data.loop_triangles)>budget:
        reduce=obj.modifiers.new('Purposeful silhouette budget','DECIMATE')
        reduce.ratio=budget/len(obj.data.loop_triangles)
        bpy.ops.object.modifier_apply(modifier=reduce.name)
        relax=obj.modifiers.new('Relax reduced organic junctions','SMOOTH')
        relax.factor=.48; relax.iterations=3
        bpy.ops.object.modifier_apply(modifier=relax.name)
    return finish(obj,part,color)


def vessel(part,name,r,bottom,top,color,center=(0,0,0),sz: float=1,n=32,shape=None):
    h=top-bottom
    return lathe(part,name,[(0,bottom),(r*.64,bottom),(r*.78,bottom+.04*h),
        (r*.86,bottom+.14*h),(r*.94,bottom+.55*h),(r*.99,top-.12*h),
        (r,top-.04*h),(r*.97,top+.025*h),(r*.90,top+.04*h),(r*.85,top-.035*h),
        (r*.84,top-.12*h),(r*.76,bottom+.27*h),(r*.64,bottom+.20*h),(0,bottom+.20*h)],
        color,n=n,center=center,sz=sz,shape=shape)


def chair():
    p='moon-chair'
    for x in (-.42,.42):
        for z in (-.17,.17):
            tube(p,'Rounded splayed chair leg',curved_points([(x*1.08,0,z*1.04),(x*1.02,.20,z),(x,.43,z)],3),lambda t:.038+.009*t,WOOD,sides=8)
    for z in (-.18,-.06,.06,.18):
        box(p,'Soft edged welcoming seat slat',(0,.42,z),(1.08,.115,.113),'#e7c185',bevel=.027)
    for x in (-.49,.49):
        tube(p,'Reclined rounded back upright',curved_points([(x,.45,-.18),(x,.74,-.23),(x*.98,1.015,-.20)],4),.040,WOOD,sides=8)
    for i in range(5):
        x=(i-2)*.183
        top=.965+.09*math.sqrt(max(0,1-(x/.48)**2))
        box(p,'Rounded arched back panel',(x,(top+.54)/2,-.20),(.17,top-.54,.105),'#f1d399',bevel=.032)
    tube(p,'Sweeping lower back rail',curved_points([(-.51,.565,-.20),(0,.54,-.19),(.51,.565,-.20)],4),.035,'#c89a65',sides=8)
    # A shallow moon inset gives the chair a small intentional identity, not clutter.
    outline=[]
    for j in range(17):
        a=math.pi*.37+(TAU-math.pi*.74)*j/16
        outline.append((.070*math.cos(a),.87+.070*math.sin(a)))
    for j in range(13):
        a=math.pi*1.35-(math.pi*.70)*j/12
        outline.append((.035+.068*math.cos(a),.87+.068*math.sin(a)))
    vertices=[(x,y,z) for z in (-.140,-.132) for x,y in outline]
    n=len(outline)
    mesh(p,'Inset crescent on chair back',vertices,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)],'#c39860',smooth=False)


def flowerpot():
    p='dandelion-pot'
    vessel(p,'Rounded hollow terracotta pot',.33,.005,.455,'#dfa58b')
    ring(p,'Soft rolled terracotta rim',(0,.449,0),.300,.300,.021,'#eac0a6',n=28)
    lathe(p,'Recessed dark soil',[(0,.383),(.26,.383),(.27,.401),(0,.408)],'#705945',n=24)
    tube(p,'Gently bowed flower stem',curved_points([(0,.39,0),(-.035,.65,.005),(.035,.92,0),(0,1.035,0)],4),.018,'#739666',sides=8)
    for side in (-1,1):
        petal(p,'Cupped lanceolate stem leaf',(0,.61,0),(side*.21,.84,.045),.063,'#91b77b')
    for layer,(radius,y,count) in enumerate(((.235,1.015,16),(.178,1.067,12),(.104,1.115,8))):
        for j in range(count):
            a=TAU*(j+.45*layer)/count
            petal(p,'Soft curled dandelion floret',(.027*math.cos(a),y,.027*math.sin(a)),
                (radius*math.cos(a),y+.04,radius*math.sin(a)),.027,'#f2d16f' if layer%2==0 else '#e9be56',rows=3)
    orb(p,'Rounded pollen crown',(0,1.133,0),(.073,.048,.073),'#ddb34f',n=12,rings=6)


def pond():
    p='tiny-pond'
    shape=lambda a:1+.055*math.sin(3*a)+.035*math.cos(5*a)
    vessel(p,'Organic hollow river-stone pool',.67,-.09,.15,'#c5c4ad',sz=.79,n=40,shape=shape)
    lathe(p,'Inset still blue water',[(0,.079),(.55,.079),(.575,.122),(.52,.129),(0,.131)],'#80bfc5','satin',n=40,sz=.76,shape=shape)
    for j in range(2):
        tube(p,'Gentle curved water ripple',[(x,.137+j*.004,.075+j*.105+.043*math.sin((x+.35)*5)) for x in [-.32+i*.05 for i in range(12)]],.005,'#d0ece3','satin')
    petal(p,'Floating curved lily leaf',(.18,.139,-.18),(.47,.145,-.11),.105,'#93b480')
    for i,(x,z) in enumerate(((-.48,-.29),(.40,.35),(-.53,.20))):
        orb(p,'Soft bank pebble',(x,.12,z),(.085,.050,.064),('#a5b19c','#b1b9a3','#8f9e87')[i],n=20,rings=8)
    # The catalog specifically promises a little swimming fish. Keep it a quiet
    # low relief at the waterline, not a second large companion or a floating orb.
    orb(p,'Tiny smooth pond fish',(-.14,.138,-.055),(.10,.013,.039),'#dfa779','satin',n=20,rings=8)
    outline=[(-.215,-.055),(-.285,-.089),(-.267,-.055),(-.285,-.021)]
    vertices=[(x,y,z) for y in (.131,.144) for x,z in outline]
    mesh(p,'Rounded small pond fish tail',vertices,[(3,2,1,0),(4,5,6,7)]+[(j,(j+1)%4,(j+1)%4+4,j+4) for j in range(4)],'#dfa779','satin',bevel=.004)
    orb(p,'Pond fish tiny eye',(-.075,.150,-.055),(.0045,.003,.0045),'#695644','satin',n=8,rings=4)


def cloud():
    p='cloud-balloon'
    tube(p,'Soft swaying balloon tether',[(.012*math.sin(i*.37),1.54*i/24,0) for i in range(25)],.012,'#bca77f',sides=6)
    control=[(-.63,1.69),(-.60,1.82),(-.48,1.91),(-.34,1.89),(-.27,2.01),(-.13,2.09),
             (.03,2.10),(.19,2.04),(.27,1.94),(.43,1.94),(.58,1.85),(.65,1.71),
             (.59,1.57),(.45,1.52),(.22,1.52),(0,1.50),(-.23,1.53),(-.43,1.51),(-.57,1.57)]
    outline=curved_points([(x,y,0) for x,y in control],3,True)
    vertices,rows,faces=[],[],[]
    for scale,z in ((0,-.25),(.40,-.238),(.72,-.19),(.92,-.11),(1,0),(.92,.11),(.72,.19),(.40,.238),(0,.25)):
        if scale==0:
            rows.append([len(vertices)]);vertices.append((0,1.78,z))
        else:
            rows.append(list(range(len(vertices),len(vertices)+len(outline))))
            vertices.extend((x*scale,1.78+(y-1.78)*scale,z) for x,y,_ in outline)
    for left,right in zip(rows,rows[1:]):
        for j in range(len(outline)):
            k=(j+1)%len(outline)
            faces.append((left[0],right[j],right[k]) if len(left)==1 else (left[j],right[0],left[k]) if len(right)==1 else (left[j],right[j],right[k],left[k]))
    mesh(p,'One smooth scalloped puff cloud',vertices,faces,'#fff8e9')
    orb(p,'Soft balloon knot',(0,1.51,0),(.047,.044,.035),'#e5d5b9',n=12,rings=6)


def cat():
    p='reading-cat'
    parts=[raw_volume('Pear shaped seated body',(0,.29,0),(.235,.32,.195)),
           raw_volume('Broad soft cat head',(0,.765,.035),(.275,.245,.23)),
           raw_volume('Blended lower cheeks and short muzzle',(0,.695,.22),(.13,.070,.070))]
    for side in (-1,1):
        parts.append(raw_volume('Small seated paw',(side*.135,.047,.14),(.087,.073,.11)))
        vertices=[(side*.10,.90,-.04),(side*.255,.875,-.04),(side*.225,1.11,.015),
                  (side*.10,.90,.10),(side*.255,.875,.10),(side*.225,1.11,.045)]
        data=bpy.data.meshes.new('Rounded kitten ear source');data.from_pydata([xyz(v) for v in vertices],[],[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]);data.update()
        ear=bpy.data.objects.new('Joined kitten ear',data);bpy.context.collection.objects.link(ear)
        bpy.context.view_layer.objects.active=ear
        bevel=ear.modifiers.new('Soft ear tip','BEVEL');bevel.width=.019;bevel.segments=3
        bpy.ops.object.modifier_apply(modifier=bevel.name);parts.append(ear)
    fur,cream=color_linear('#dbae7a')[:3],color_linear('#f3dcb9')[:3]
    def cat_color(co):
        x,y,z=co
        front=min(1,max(0,(z-.13)/.07))
        face=((x/.155)**2+((y-.697)/.077)**2)
        bib=((x/.17)**2+((y-.28)/.235)**2)
        patch=max(min(1,max(0,(1.08-face)/.34)),min(1,max(0,(1.04-bib)/.32)))*front
        patch=patch*patch*(3-2*patch)
        return tuple(a*(1-patch)+b*patch for a,b in zip(fur,cream))
    unified(p,'Connected seated kitten sculpt',parts,cat_color,budget=4100,voxel=.008)
    for side in (-1,1):
        petal(p,'Small warm inner ear',(side*.177,.954,.095),(side*.223,1.065,.05),.030,'#d59485',rows=3)
        orb(p,'Soft reading eye',(side*.105,.795,.254),(.029,.036,.012),'#39352e','satin',n=14,rings=8)
        orb(p,'Small eye sparkle',(side*.100,.806,.266),(.006,.008,.003),CREAM,'satin',n=8,rings=4)
        tube(p,'Curved forearm resting on book',curved_points([(side*.182,.52,.08),(side*.205,.47,.21),(side*.18,.416,.34)],5),lambda t:.042-.007*t,'#dbae7a',sides=8)
        orb(p,'Book holding paw',(side*.18,.416,.34),(.046,.036,.042),'#efd0a5',n=12,rings=6)
    orb(p,'Small soft rose nose',(0,.725,.294),(.020,.014,.009),'#a46f60',n=12,rings=6)
    tube(p,'Tiny kitten smile',curved_points([(-.026,.701,.286),(0,.694,.292),(.026,.701,.286)],5),.0045,'#8b6d55',sides=5)
    tube(p,'Tail tucked around sitting body',curved_points([(-.20,.11,-.08),(-.265,.07,.03),(-.254,.075,.16),(-.195,.105,.22),(-.13,.115,.20)],5),lambda t:.038-.014*t,'#be9164',sides=8)
    for y,z0,z1,color,name in ((.345,.18,.48,'#82a993','Rounded open book cover'),(.369,.192,.472,CREAM,'Soft cream pages')):
        outline=[(-.265,y+.045),(0,y),(.265,y+.045),(.265,y+.069),(0,y+.025),(-.265,y+.069)]
        vertices=[(x,h,z) for z in (z0,z1) for x,h in outline]
        mesh(p,name,vertices,[(5,4,3,2,1,0),(6,7,8,9,10,11)]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)],color,smooth=False,bevel=.007)
    for side in (-1,1):
        for j in range(3):
            tube(p,'Quiet embossed page line',[(side*.055,.399,.25+j*.059),(side*.205,.425,.25+j*.059)],.0023,'#cbbd9e',sides=4)
    tube(p,'Curved book gutter',[(0,.390,.19),(0,.390,.48)],.0045,'#bfac85',sides=6)


def flag():
    p='rainbow-flag'
    tube(p,'Rounded wooden flagpole',[(0,.025,0),(0,1.325,0)],.030,WOOD,sides=12)
    orb(p,'Round pole finial',(0,1.325,0),(.034,.035,.034),'#be9265',n=12,rings=6)
    orb(p,'Round pole foot',(0,.026,0),(.031,.027,.031),WOOD,n=12,rings=6)
    vertices=[]
    for side in (-1,1):
        for row in range(7):
            for i in range(21):
                t=i/20;x=.015+.525*t
                vertices.append((x,1.27-row*.063-.028*t*t+.010*math.sin(t*math.pi),.026*math.sin(t*math.pi*1.7)+side*.004))
    faces=[];layer=7*21
    for row in range(6):
        for i in range(20):
            a=row*21+i;faces.extend([(a,a+1,a+22,a+21),(layer+a,layer+a+21,layer+a+22,layer+a+1)])
        a=row*21;faces.extend([(a,a+21,a+21+layer,a+layer),(a+20,a+20+layer,a+41+layer,a+41)])
    for i in range(20):faces.extend([(i,layer+i,layer+i+1,i+1),(126+i,127+i,127+i+layer,126+i+layer)])
    ob=mesh(p,'Soft wind-curved tricolor flag',vertices,faces,'#df9b87')
    colors=ob.data.color_attributes.active_color
    for face in ob.data.polygons:
        x,y,z=yup(face.center);t=(x-.015)/.525
        stripe=min(2,max(0,int((1.27-y-.028*t*t+.010*math.sin(t*math.pi))/.126)))
        for li in face.loop_indices:colors.data[li].color=color_linear(('#e39c89','#eed39a','#8fb7a0')[stripe])


def basket():
    p='picnic-basket'
    vessel(p,'Rounded open wicker basket shell',.35,.01,.48,'#ad8055',sz=.65,n=24)
    outside=((.01,.224),(.0288,.273),(.0758,.301),(.2685,.329),(.4236,.3465),(.4612,.35),(.4988,.3395))
    def radius_at(y):
        for (a,ra),(b,rb) in zip(outside,outside[1:]):
            if a<=y<=b:return ra+(rb-ra)*(y-a)/(b-a)
        return outside[-1][1]
    for row in range(6):
        y=.070+row*.075;rx=radius_at(y)+.007
        pts=[]
        for j in range(28):
            a=TAU*j/28;bump=.005*math.cos(a*12+row*math.pi)
            pts.append(((rx+bump)*math.cos(a),y,(rx*.65+bump)*math.sin(a)))
        tube(p,'Rounded woven wicker course',pts,.012,'#caa577' if row%2 else '#bc9467',sides=4,closed=True)
    for j in range(12):
        a=TAU*(j+.5)/12
        tube(p,'Soft woven upright stake',[(
            (radius_at(.05+.43*i/4)+.012+.004*math.sin(i*math.pi))*math.cos(a),
            .05+.43*i/4,(radius_at(.05+.43*i/4)*.65+.012)*math.sin(a)) for i in range(5)],.010,'#dfbc85',sides=4)
    ring(p,'Padded bound wicker rim',(0,.486,0),.340,.222,.023,'#e0bc86',n=28,sides=6)
    tube(p,'Smooth oval basket handle',[(.30*math.cos(math.pi*j/24),.48+.38*math.sin(math.pi*j/24),0) for j in range(25)],.025,'#d2aa74',sides=8)


def strawberries():
    p='strawberry-patch'
    box(p,'Recessed planter soil',(0,.075,0),(.87,.12,.54),'#715844',bevel=.035)
    for z in (-.28,.28):box(p,'Rounded planter long plank',(0,.09,z),(.90,.18,.045),WOOD,bevel=.018)
    for x in (-.43,.43):box(p,'Rounded planter end plank',(x,.09,0),(.05,.18,.60),WOOD,bevel=.018)
    for x in (-.28,0,.28):
        tube(p,'Curved berry stem',curved_points([(x,.12,0),(x-.025,.36,-.015),(x+.03,.58,-.02)],3),.013,'#709765')
        for side in (-1,1):
            petal(p,'Broad cupped strawberry leaf',(x,.30,0),(x+side*.38,.53,-.055),.12,'#7fa46e')
        petal(p,'Upright folded strawberry leaf',(x,.41,-.02),(x+.06,.65,-.18),.095,'#9bb985')
        c=(x,.25,.20)
        lathe(p,'Soft heart-shaped ripe strawberry',[(0,-.14),(.035,-.115),(.066,-.070),(.096,-.005),(.113,.058),(.102,.103),(.071,.135),(0,.143)],'#d97b72',n=16,center=c,sz=.88)
        for j in range(5):
            a=TAU*j/5
            petal(p,'Curved five-leaf berry calyx',(x,.39,.20),(x+.11*math.cos(a),.37,.20+.09*math.sin(a)),.022,'#698b57',rows=3)
        for i in range(2):
            for j in range(4):
                a=.25+math.pi*j/3;r=.084 if i==0 else .108
                orb(p,'Embedded strawberry seed',(x+r*math.cos(a),.205+i*.070,.20+r*.88*math.sin(a)),(.006,.010,.004),'#eed29b',n=6,rings=3)


def mushroom():
    p='mushroom-home'
    # One continuous thick stem wall includes the arched negative-space doorway.
    vertices=[];n=80;fractions=(0,.50,1)
    for radius in (.34,.40):
        for fraction in fractions:
            for i in range(n):
                a=TAU*i/n;front=abs((a-math.pi/2+math.pi)%TAU-math.pi)
                lower=.36+.24*math.sqrt(max(0,1-(front/.57)**2)) if front<.57 else -.05
                y=lower+(.77-lower)*fraction
                r=radius*(1+.035*math.sin((y+.05)/.82*math.pi))
                vertices.append((r*math.cos(a),y,r*math.sin(a)))
    faces=[];layer=n*len(fractions)
    for row in range(len(fractions)-1):
        for i in range(n):
            j=(i+1)%n;v=row*n
            faces.extend([(v+i,v+n+i,v+n+j,v+j),(layer+v+i,layer+v+j,layer+v+n+j,layer+v+n+i)])
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,layer+j,layer+i),(2*n+i,layer+2*n+i,layer+2*n+j,2*n+j)])
    mesh(p,'One hollow cottage wall and arched doorway',vertices,faces,'#f3e6c9')
    arc=curved_points([(.225,.36,.365),(.180,.51,.365),(0,.60,.365),(-.180,.51,.365),(-.225,.36,.365)],4)
    tube(p,'Continuous rounded doorway surround',[(-.225,-.02,.365),*reversed(arc),(.225,-.02,.365)],.034,'#c8b38d',sides=8)
    box(p,'Interior wooden floor',(0,-.025,0),(.54,.05,.56),'#967b5b',bevel=.014)
    top=lambda r:.77+.42*max(0,1-(r/.66)**2)**.63
    profile=[(0,.70),(.37,.70),(.56,.715),(.63,.75),(.66,.79)]
    profile += [(r,top(r)) for r in (.65,.62,.57,.50,.42,.32,.21,.10,0)]
    lathe(p,'Rounded storybook mushroom cap',profile,'#d5917e',n=40,sz=.91)
    ring(p,'Soft cream cap underside',(0,.755,0),.614,.558,.017,'#e3bda1',n=40,sides=6)
    for x,z,r in ((0,0,.084),(-.28,.08,.074),(.30,.11,.071),(-.13,.32,.064),(.14,-.34,.072)):
        radial=math.sqrt(x*x+(z/.91)**2);y=top(radial)+.005
        dot=orb(p,'Flush ivory cap marking',(x,y,z),(r,.010,r*.85),CREAM,n=14,rings=5)
        normal=Vector((x*.9,.75,z*.9)).normalized();rot=Vector((0,1,0)).rotation_difference(normal)
        for vertex in dot.data.vertices:vertex.co=xyz(rot@(Vector(yup(vertex.co))-Vector((x,y,z)))+Vector((x,y,z)))


def bath(fountain=False):
    p='pebble-fountain' if fountain else 'bird-bath'
    lathe(p,'Soft turned river-stone pedestal',[(0,0),(.20,0),(.24,.018),(.25,.045),(.22,.081),(.16,.118),
        (.125,.18),(.115,.35),(.125,.46),(.16,.51),(.20,.55),(0,.55)],'#b4b7a1',n=28,sz=.82)
    vessel(p,'Rounded hollow birdbath basin',.50,.51,.72,'#c8cbb7',sz=.80,n=32)
    lathe(p,'Recessed clear-blue basin water',[(0,.636),(.40,.636),(.42,.682),(0,.689)],'#96cbd0','satin',n=32,sz=.79)
    if fountain:
        for i,(c,r) in enumerate((((0,.72,0),(.24,.085,.19)),((-.035,.83,-.01),(.18,.075,.14)),((.015,.925,0),(.115,.066,.10)))):
            orb(p,'Smooth stacked river pebble',c,r,('#a0ab95','#b1bba3','#96a38e')[i],n=24,rings=10)
        tube(p,'Soft rising fountain jet',curved_points([(.015,.95,0),(.01,1.04,0),(0,1.10,0)],4),lambda t:.022-.010*t,'#acdce0','satin',sides=8)
        for side in (-1,1):
            tube(p,'Continuous arcing fountain stream',curved_points([(0,1.08,0),(side*.065,1.055,.008),(side*.13,.95,.015),(side*.16,.76,.025)],5),lambda t:.011-.003*t,'#a1d6db','satin',sides=6)
    else:
        unified(p,'One soft perched bird form',[
            raw_volume('Bird pear body',(.29,.798,0),(.11,.085,.080),24,14),
            raw_volume('Bird joined round head',(.337,.884,.018),(.067,.066,.061),24,14),
        ],'#e6c488',budget=650,voxel=.006)
        petal(p,'Tucked little bird wing',(.225,.831,.069),(.34,.766,.072),.043,'#b89769')
        petal(p,'Rounded short bird tail',(.245,.79,-.018),(.173,.817,-.055),.028,'#d2af77',rows=3)
        tube(p,'Tiny tapered bird beak',[(.385,.888,.018),(.432,.881,.018)],lambda t:.019*(1-.90*t),'#ae8354',sides=8)
        orb(p,'Small warm bird eye',(.359,.909,.069),(.009,.010,.004),'#373c32',n=10,rings=5)


def lantern():
    p='firefly-lantern'
    tube(p,'Rounded lantern stake',[(0,.018,0),(0,.68,0)],.034,WOOD,sides=12)
    lathe(p,'Rounded lantern tray',[(0,.64),(.17,.64),(.22,.65),(.25,.68),(.23,.707),(.18,.715),(0,.715)],'#ab835c',n=28)
    for j in range(6):
        a=TAU*j/6
        points=[(.202*math.cos(a),.69,.202*math.sin(a)),(.222*math.cos(a),.91,.222*math.sin(a)),(.198*math.cos(a),1.155,.198*math.sin(a))]
        tube(p,'Gently bowed wooden lantern rib',curved_points(points,5),.015,'#b38d65',sides=6)
    for y in (.72,1.14):ring(p,'Soft bound lantern band',(0,y,0),.207,.207,.017,'#d6b887',n=28,sides=6)
    lathe(p,'Soft domed lantern bonnet',[(0,1.14),(.20,1.14),(.247,1.155),(.25,1.18),(.225,1.205),(.16,1.24),(.085,1.267),(0,1.275)],'#c09a6b',n=28)
    ring(p,'Rounded hanging loop',(0,1.28,0),.044,.044,.012,'#9c7855',True,n=24,sides=6)
    orb(p,'Soft amber firefly heart',(0,.92,0),(.086,.145,.086),'#f1cf78','satin',n=20,rings=10)
    for j in range(3):
        a=TAU*j/3
        orb(p,'Floating ivory firefly',(.115*math.cos(a),.86+.065*j,.115*math.sin(a)),(.013,.019,.013),'#fff0b1','satin',n=8,rings=4)


def watering_can():
    p='watering-can'
    vessel(p,'Rounded hollow enamel watering can',.25,-.215,.215,'#80aeb4')
    ring(p,'Soft rolled can opening',(0,.21,0),.231,.231,.014,'#a0c4c5',n=28)
    # Closed-wall tubular spout retains a genuine open aperture at its end.
    ob=lathe(p,'Rounded hollow pouring spout',[(.065,0),(.069,.04),(.051,.48),(.055,.525),(.057,.545),(.053,.56),(.045,.56),(.040,.54),(.039,.52),(.051,.04),(.055,0),(.065,0)],'#80aeb4','satin',n=24)
    rotation=Vector((0,1,0)).rotation_difference(Vector((.80,.60,0)))
    for vertex in ob.data.vertices:vertex.co=xyz(rotation@Vector(yup(vertex.co))+Vector((.16,-.04,0)))
    tube(p,'Smooth oval side carry handle',curved_points([(-.17,.15,0),(-.34,.205,0),(-.45,.16,0),(-.455,.015,0),(-.35,-.12,0),(-.18,-.12,0)],5),.026,'#6f9da6',sides=8)
    ring(p,'Rounded can foot seam',(0,-.18,0),.185,.185,.009,'#64949e',n=28,sides=6)


def sun():
    p='sunlight-token'
    orb(p,'Soft convex golden sun face',(0,0,0),(.32,.32,.14),'#e8bc64','satin',n=32,rings=16)
    ring(p,'Rounded sun face bezel',(0,0,.073),.291,.291,.012,'#f3d58a',True,n=40,role='satin')
    for j in range(8):
        a=TAU*j/8;d=Vector((math.cos(a),math.sin(a),0))
        petal(p,'Rounded petal sun ray',tuple(d*.295),tuple(d*.58),.055,'#e7b65a',rows=5)
    for side in (-1,1):
        orb(p,'Gentle sun eye',(side*.095,.048,.131),(.015,.023,.006),'#a27543',n=12,rings=6)
    tube(p,'Small smiling sun',curved_points([(-.065,-.054,.135),(0,-.082,.137),(.065,-.054,.135)],5),.006,'#a27543',sides=6)


def fit_part(part):
    objects=FEATURES[part]
    coords=[yup(v.co) for ob in objects for v in ob.data.vertices]
    lo=[min(v[i] for v in coords) for i in range(3)]
    hi=[max(v[i] for v in coords) for i in range(3)]
    target=BASELINE[part]
    scale=[target['size'][i]/(hi[i]-lo[i]) for i in range(3)]
    for ob in objects:
        for v in ob.data.vertices:
            co=yup(v.co)
            v.co=xyz([target['min'][i]+(co[i]-lo[i])*scale[i] for i in range(3)])
        ob.data.update()
        # Reproject UVs after final orientation, including the angled spout.
        uv=ob.data.uv_layers.active
        for f in ob.data.polygons:
            axes=[i for i in range(3) if i!=max(range(3),key=lambda i:abs(f.normal[i]))]
            for li in f.loop_indices:
                co=ob.data.vertices[ob.data.loops[li].vertex_index].co
                uv.data[li].uv=((co[axes[0]]+2)/4,(co[axes[1]]+2)/4)
    PARTS[part]['baseline_fit_scale']=scale
    PARTS[part]['features']=[ob.name for ob in objects]
    PARTS[part]['surface']='satin' if part in ('watering-can','sunlight-token') else 'matte'


def build():
    global bpy,bmesh,Vector,MATERIALS
    import bpy
    import bmesh
    from mathutils import Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.context.preferences.filepaths.file_preview_type='NONE'
    MATERIALS={}
    for role,roughness in (('matte',.76),('satin',.30)):
        m=bpy.data.materials.new('Korean shared '+role+' vertex color')
        m.use_nodes=True
        bsdf=m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value=(1,1,1,1)
        bsdf.inputs['Metallic'].default_value=0
        bsdf.inputs['Roughness'].default_value=roughness
        c=m.node_tree.nodes.new('ShaderNodeVertexColor'); c.layer_name='Color'
        m.node_tree.links.new(c.outputs['Color'],bsdf.inputs['Base Color'])
        MATERIALS[role]=m
    root=empty('korean-props')
    root['up_axis']='+Y'; root['blender_version']=bpy.app.version_string
    root['asset_revision']='storybook-curves-v2'
    root['authoring']='Original curved storybook geometry; matched Cycles visual review; no external assets'
    for part in IDS:
        PARTS[part]=empty(part,root); FEATURES[part]=[]
    for make in (chair,flowerpot,pond,cloud,cat,flag,basket,strawberries,mushroom,bath,lambda:bath(True),lantern,watering_can,sun):
        make()
    for part in IDS:
        fit_part(part)
    bpy.context.scene['coordinate_contract']='Y-up export, all local origins and group transforms identity; +Z front'
    bpy.context.scene['library_usage']='Parts overlap at origin intentionally; isolate a named group to edit; no placement baked in'
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND),compress=True)
    for part in IDS:
        bpy.ops.object.select_all(action='DESELECT')
        for ob in FEATURES[part]:
            ob.select_set(True)
        bpy.context.view_layer.objects.active=FEATURES[part][0]
        bpy.ops.object.join()
        ob=bpy.context.object
        ob.name=part+'-mesh'; ob.data.name=part+'-geometry'
        ob['feature_count']=len(PARTS[part]['features'])
    bpy.ops.object.select_all(action='SELECT')
    GLB.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,
        export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,
        export_materials='EXPORT',export_animations=False,export_cameras=False,
        export_lights=False,export_extras=True)
    print('COMPLETE_EXPORT',GLB,GLB.stat().st_size,flush=True)


if __name__=='__main__':
    if '--verify-only' not in sys.argv:
        build()
    import runpy
    runpy.run_path(str(HERE/'verify_props_korean.py'),run_name='__main__')
