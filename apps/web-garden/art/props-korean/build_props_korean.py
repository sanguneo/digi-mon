"""Deterministic, original Korean garden props. Geometry/data only.

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
    col = ob.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    uv = ob.data.uv_layers.new(name='UVMap')
    for face in ob.data.polygons:
        face.use_smooth = smooth
        axes = [i for i in range(3) if i != max(range(3), key=lambda i: abs(face.normal[i]))]
        for li in face.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv.data[li].uv = ((p[axes[0]]+2)/4, (p[axes[1]]+2)/4)
            col.data[li].color = color_linear(color(yup(p)) if callable(color) else color)
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
        mod.width, mod.segments = bevel, 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(ob, part, color, role, smooth)


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


def petal(part,name,start,end,width,color):
    a,b=Vector(start),Vector(end)
    d=b-a
    side=d.cross(Vector((0,0,1)) if abs(d.normalized().z)<.8 else Vector((0,1,0))).normalized()*width
    ridge=d.normalized().cross(side).normalized()*.014
    mid=a+d*.52
    verts=[tuple(a),tuple(mid-side),tuple(b),tuple(mid+side),tuple(mid+ridge),tuple(mid-ridge)]
    faces=[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(1,0,5),(2,1,5),(3,2,5),(0,3,5)]
    return mesh(part,name,verts,faces,color,smooth=True)


def vessel(part,name,r,bottom,top,color,center=(0,0,0),sz: float=1,n=32,shape=None):
    h=top-bottom
    return lathe(part,name,[(0,bottom),(r*.72,bottom),(r*.80,bottom+.08*h),
        (r*.99,top-.06*h),(r,top),(r*.91,top+.025*h),(r*.85,top-.07*h),
        (r*.65,bottom+.18*h),(0,bottom+.18*h)],color,n=n,center=center,sz=sz,shape=shape)


def chair():
    p='moon-chair'
    for x in (-.42,.42):
        for z in (-.17,.17):
            tube(p,'Splayed wooden leg',[(x*1.08,.0,z*1.04),(x,.43,z)],.044,WOOD,sides=8)
    for z in (-.19,-.063,.063,.19):
        box(p,'Bevelled seat slat',(0,.42,z),(1.1,.12,.115),'#edcb88')
    for x in (-.5,.5):
        box(p,'Back upright',(x,.76,-.20),(.08,.59,.10),WOOD)
    for i in range(7):
        x=(i-3)*.143
        y=.91+.10*math.sqrt(max(0,1-(x/.50)**2))
        box(p,'Arched back slat',(x,(y+.51)/2,-.20),(.127,y-.51,.12),'#f6db9d')
    tube(p,'Lower back rail',[(-.52,.57,-.20),(.52,.57,-.20)],.04,'#edcb88',sides=8)


def flowerpot():
    p='dandelion-pot'
    vessel(p,'Hollow terracotta pot',.33,.005,.455,'#de9d7f')
    ring(p,'Rolled terracotta rim',(0,.449,0),.304,.304,.025,'#e9b295')
    lathe(p,'Recessed soil',[(0,.389),(.27,.389),(.27,.404),(0,.407)],'#705945',n=24)
    tube(p,'Curved green stem',[(0,.39,0),(-.035,.65,.005),(.035,.92,0),(0,1.035,0)],.018,GREEN)
    for s in (-1,1):
        petal(p,'Lanceolate stem leaf',(0,.61,0),(s*.21,.85,.045),.057,GREEN)
    for layer,(radius,y,count) in enumerate(((.23,1.02,16),(.18,1.075,13),(.105,1.125,9))):
        for j in range(count):
            a=TAU*(j+.35*layer)/count
            petal(p,'Layered dandelion floret',(.035*math.cos(a),y, .035*math.sin(a)),
                  (radius*math.cos(a),y+.04,radius*math.sin(a)),.034,'#fff1b3' if layer%2==0 else '#efd17d')
    orb(p,'Dandelion pollen crown',(0,1.13,0),(.075,.052,.075),'#eac75c',n=12,rings=6)


def pond():
    p='tiny-pond'
    shape=lambda a: 1+.065*math.sin(3*a)+.035*math.cos(5*a)
    vessel(p,'Shaped hollow stone basin',.67,-.09,.15,'#c6c1a6',sz=.79,shape=shape)
    lathe(p,'Shaped inset water',[(0,.078),(.55,.078),(.575,.125),(.50,.13),(0,.131)],'#63a8b8','satin',n=40,sz=.76,shape=shape)
    for j in range(2):
        tube(p,'Water ripple',[(x,.14+j*.005,.08+j*.10+.065*math.sin((x+.35)*5)) for x in [-.35+i*.055 for i in range(12)]],.008,'#c4e8df','satin')
    petal(p,'Floating lily leaf',(.20,.142,-.20),(.47,.153,-.13),.08,GREEN)
    for x,z in ((-.48,-.29),(.40,.35),(-.53,.20)):
        orb(p,'Bank pebble',(x,.12,z),(.085,.052,.064),'#a9ad94',n=12,rings=6)


def cloud():
    p='cloud-balloon'
    tube(p,'Balloon tether',[(.015*math.sin(i*.55),1.56*i/20,0) for i in range(21)],.016,'#b6a17b')
    # One continuous volumetric cloud outline with curved front/back shells.
    outline=[(-.63,1.69),(-.60,1.82),(-.48,1.91),(-.34,1.89),(-.27,2.01),(-.13,2.09),
             (.03,2.10),(.19,2.04),(.27,1.94),(.43,1.94),(.58,1.85),(.65,1.71),
             (.59,1.57),(.45,1.52),(.22,1.52),(0,1.50),(-.23,1.53),(-.43,1.51),(-.57,1.57)]
    verts,rows,faces=[],[],[]
    for scale,z in ((.0,-.25),(.55,-.22),(.90,-.13),(1,0),(.90,.13),(.55,.22),(.0,.25)):
        if scale==0:
            rows.append([len(verts)]); verts.append((0,1.78,z))
        else:
            rows.append(list(range(len(verts),len(verts)+len(outline))))
            verts.extend((x*scale,1.78+(y-1.78)*scale,z) for x,y in outline)
    for a,b in zip(rows,rows[1:]):
        for j in range(len(outline)):
            k=(j+1)%len(outline)
            faces.append((a[0],b[j],b[k]) if len(a)==1 else (a[j],b[0],a[k]) if len(b)==1 else (a[j],b[j],b[k],a[k]))
    mesh(p,'Continuous formed cloud envelope',verts,faces,'#fffaf0')
    orb(p,'Balloon neck knot',(0,1.51,0),(.055,.05,.04),'#efdfc6',n=12,rings=6)


def cat():
    p='reading-cat'
    # Shared radial rings form one closed body-neck-head loft.
    sections=[(0,-.03,0),(.16,.015,0),(.26,.12,0),(.29,.30,0),(.255,.45,0),
              (.18,.56,.015),(.195,.60,.035),(.265,.69,.045),(.275,.79,.05),
              (.23,.90,.05),(.13,.965,.05),(0,.982,.05)]
    v,rows,f=[],[],[]
    for r,y,z in sections:
        if r==0:
            rows.append([len(v)]); v.append((0,y,z))
        else:
            rows.append(list(range(len(v),len(v)+32)))
            v.extend((r*math.cos(TAU*j/32),y,z+r*.80*math.sin(TAU*j/32)) for j in range(32))
    for a,b in zip(rows,rows[1:]):
        for j in range(32):
            k=(j+1)%32
            f.append((a[0],b[k],b[j]) if len(a)==1 else (a[j],a[k],b[0]) if len(b)==1 else (a[j],a[k],b[k],b[j]))
    mesh(p,'Connected cat body neck head',v,f,lambda co: '#f1d6ad' if co[2]>.12 and co[1]<.57 else '#e6be87')
    for s in (-1,1):
        mesh(p,'Triangular cat ear',[(s*.08,.89,-.04),(s*.255,.86,-.04),(s*.235,1.11,.01),
             (s*.08,.89,.10),(s*.255,.86,.10),(s*.235,1.11,.04)],[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'#e6be87',bevel=.013)
        mesh(p,'Ear inner velvet',[(x,y,z+depth) for depth in (0,.004) for x,y,z in
             ((s*.14,.921,.108),(s*.224,.912,.108),(s*.224,1.055,.068))],
             [(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'#d99581',smooth=False)
        orb(p,'Cat almond eye',(s*.103,.786,.259),(.027,.038,.018),'#443d35','satin',n=12,rings=6)
        orb(p,'Eye catchlight',(s*.098,.798,.275),(.007,.010,.004),CREAM,'satin',n=8,rings=4)
        orb(p,'Rounded muzzle',(s*.047,.688,.260),(.060,.039,.03),CREAM,n=12,rings=6)
        tube(p,'Forearm on open book',[(s*.195,.51,.10),(s*.225,.43,.24),(s*.18,.405,.35)],.049,'#e6be87',sides=10)
        orb(p,'Seated paw',(s*.145,.046,.14),(.096,.072,.105),'#e6be87',n=12,rings=6)
    orb(p,'Soft rose nose',(0,.717,.293),(.021,.017,.013),'#b27869',n=10,rings=6)
    tube(p,'Curled tail',[(-.23,.12,-.04),(-.28,.16,.01),(-.26,.23,.08),(-.23,.24,.14),(-.20,.19,.18)],.038,'#c99867',sides=8)
    # Extruded open-book halves, raised outer edges and recessed center gutter.
    for y,z0,z1,color,name in ((.345,.18,.48,'#8db7a0','Open green book cover'),(.371,.192,.472,CREAM,'Thick cream page block')):
        outline=[(-.265,y+.050),(0,y),(.265,y+.050),(.265,y+.075),(0,y+.025),(-.265,y+.075)]
        verts=[(x,h,z) for z in (z0,z1) for x,h in outline]
        mesh(p,name,verts,[(5,4,3,2,1,0),(6,7,8,9,10,11)]+
             [(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)],color,smooth=False,bevel=.003)
    for s in (-1,1):
        for j in range(4):
            tube(p,'Raised page line',[(s*.055,.400,.24+j*.045),(s*.215,.430,.24+j*.045)],.0025,'#c9ba9c',sides=4)
    tube(p,'Book gutter',[(0,.389,.19),(0,.389,.48)],.006,'#c5ac7f',sides=6)


def flag():
    p='rainbow-flag'
    tube(p,'Wooden flagpole',[(0,0,0),(0,1.36,0)],.035,WOOD,sides=12)
    v=[]
    for side in (-1,1):
        for row in range(4):
            for i in range(17):
                x=.015+.525*i/16
                v.append((x,1.28-row*.13-.034*(x/.54)**2,.020*math.sin(x*12)+side*.005))
    f=[]
    for row in range(3):
        for i in range(16):
            a=row*17+i
            f.extend([(a,a+1,a+18,a+17),(68+a,85+a,86+a,69+a)])
        a=row*17
        f.extend([(a,a+17,a+85,a+68),(a+16,a+84,a+101,a+33)])
    for i in range(16):
        f.extend([(i,68+i,69+i,i+1),(51+i,52+i,120+i,119+i)])
    ob=mesh(p,'Continuous curved rainbow cloth',v,f,'#e89986')
    colors=ob.data.color_attributes.active_color
    for face in ob.data.polygons:
        x,y,z=yup(face.center)
        stripe=min(2,max(0,int((1.28-y-.034*(x/.54)**2)/.13)))
        for li in face.loop_indices:
            colors.data[li].color=color_linear(('#e89986','#f4d277','#8fbaa2')[stripe])


def basket():
    p='picnic-basket'
    vessel(p,'Open basket inner shell',.35,.01,.48,'#ad7e50',sz=.65,n=24)
    for row in range(7):
        y=.065+row*.062
        rx=.27+.07*row/6
        pts=[]
        for j in range(32):
            a=TAU*j/32
            bump=.006*math.cos(a*16+row*math.pi)
            pts.append(((rx+bump)*math.cos(a),y,(rx*.66+bump)*math.sin(a)))
        tube(p,'Woven horizontal wicker course',pts,.014,'#cba16c' if row%2 else '#bd9261',sides=4,closed=True)
    for j in range(16):
        a=TAU*(j+.5)/16
        tube(p,'Interlaced vertical wicker stake',[((.272+.069*i/4+.006*math.sin(i*math.pi))*math.cos(a),.04+.44*i/4,
              (.181+.045*i/4)*math.sin(a)) for i in range(5)],.012,'#e3bd76',sides=4)
    ring(p,'Thick bound basket rim',(0,.49,0),.344,.225,.029,'#e3bd76',n=32,sides=6)
    tube(p,'Arched wicker carry handle',[(.30*math.cos(math.pi*j/20),.48+.38*math.sin(math.pi*j/20),0) for j in range(21)],.025,'#e3bd76',sides=8)


def strawberries():
    p='strawberry-patch'
    box(p,'Recessed planter soil',(0,.08,0),(.87,.12,.54),'#715844')
    for z in (-.28,.28):
        box(p,'Planter long plank',(0,.09,z),(.90,.18,.04),WOOD)
    for x in (-.43,.43):
        box(p,'Planter end plank',(x,.09,0),(.045,.18,.60),WOOD)
    for x in (-.28,0,.28):
        tube(p,'Berry stem',[(x,.12,0),(x,.44,0),(x+.03,.58,-.02)],.013,GREEN)
        for s in (-1,1):
            petal(p,'Serrated strawberry leaf',(x,.30,0),(x+s*.38,.53,-.055),.12,GREEN)
            petal(p,'Upright strawberry leaf',(x,.41,-.02),(x+s*.14,.65,-.18),.085,'#94b780')
        c=(x,.25,.20)
        lathe(p,'Tapered ripe strawberry',[(0,-.14),(.058,-.08),(.107,.01),(.115,.075),(.078,.13),(0,.145)],'#df7b74',n=16,center=c,sz=.88)
        for j in range(5):
            a=TAU*j/5
            petal(p,'Five-point berry calyx',(x,.39,.20),(x+.11*math.cos(a),.37,.20+.09*math.sin(a)),.026,'#6c985f')
        for i in range(3):
            for j in range(4):
                a=.3+math.pi*j/3
                r=.083 if i!=1 else .105
                orb(p,'Strawberry seed',(x+r*math.cos(a),.19+i*.055,.20+r*.88*math.sin(a)),(.007,.012,.005),'#f7db8c',n=6,rings=4)


def mushroom():
    p='mushroom-home'
    # C-shaped wall section leaves a real open entrance facing +Z.
    v=[]
    n=28
    for y in (-.05,.77):
        for r in (.34,.40):
            for i in range(n+1):
                a=math.pi/2+.57+(TAU-1.14)*i/n
                v.append((r*math.cos(a),y,r*math.sin(a)))
    f=[]; k=n+1
    for i in range(n):
        f.extend([(i,i+1,k+i+1,k+i),(2*k+i,3*k+i,3*k+i+1,2*k+i+1),
                  (i,2*k+i,2*k+i+1,i+1),(k+i,k+i+1,3*k+i+1,3*k+i)])
    f.extend([(0,k,3*k,2*k),(n,2*k+n,3*k+n,k+n)])
    mesh(p,'Thick hollow cottage wall with entrance',v,f,CREAM)
    arc=[(.225*math.cos(math.pi*j/16),.36+.23*math.sin(math.pi*j/16),.365) for j in range(17)]
    tube(p,'Rounded entrance arch',arc,.041,'#cfb78f',sides=8)
    for x in (-.225,.225):
        tube(p,'Entrance jamb',[(x,-.02,.365),(x,.36,.365)],.041,'#cfb78f',sides=8)
    box(p,'Interior floor',(0,-.025,0),(.54,.05,.56),'#8a7057')
    lathe(p,'Thick sculpted mushroom roof',[(0,.70),(.38,.70),(.57,.72),(.65,.78),(.66,.84),(.62,.94),(.48,1.08),(.27,1.17),(0,1.19)],'#d99581',n=40,sz=.91)
    ring(p,'Cream roof underside lip',(0,.768,0),.614,.558,.022,'#e9bf9f',n=40,sides=6)
    for x,y,z,r in ((0,1.184,0,.095),(-.28,1.115,.08,.085),(.30,1.10,.11,.082),(-.13,1.08,.32,.07),(.14,1.07,-.34,.08)):
        orb(p,'Mushroom cap ivory spot',(x,y,z),(r,.017,r*.85),CREAM,n=12,rings=4)


def bath(fountain=False):
    p='pebble-fountain' if fountain else 'bird-bath'
    lathe(p,'Turned stone pedestal',[(0,0),(.23,0),(.25,.04),(.21,.09),(.12,.14),(.12,.48),(.20,.55),(0,.55)],'#b9b7a1',n=24,sz=.82)
    vessel(p,'Hollow birdbath bowl',.50,.51,.72,'#c7c8b2',sz=.80)
    lathe(p,'Inset birdbath water',[(0,.635),(.40,.635),(.42,.687),(0,.69)],'#9edce4','satin',n=32,sz=.79)
    if fountain:
        for c,r in (((0,.72,0),(.24,.085,.19)),((-.035,.83,-.01),(.18,.075,.14)),((.015,.925,0),(.115,.066,.10))):
            orb(p,'Stacked fountain river stone',c,r,'#9fa993',n=16,rings=6)
        tube(p,'Rising fountain jet',[(.015,.95,0),(.01,1.04,0),(0,1.10,0)],.025,'#a7dde1','satin',sides=8)
        for s in (-1,1):
            tube(p,'Falling water stream',[(0,1.07,0),(s*.065,1.04,0),(s*.13,.95,0),(s*.16,.76,0)],.014,'#a7dde1','satin')
    else:
        orb(p,'Perched bird body',(.30,.805,0),(.115,.09,.082),'#eac484',n=16,rings=6)
        orb(p,'Perched bird head',(.34,.90,.014),(.064,.05,.058),'#eac484',n=12,rings=6)
        petal(p,'Bird wing',(.23,.83,.063),(.35,.77,.07),.045,'#bd9363')
        tube(p,'Bird beak',[(.385,.90,.01),(.43,.887,.01)],lambda t:.024*(1-.85*t),'#b98a51',sides=6)
        orb(p,'Bird eye',(.357,.912,.064),(.010,.011,.005),'#443d35',n=8,rings=4)


def lantern():
    p='firefly-lantern'
    tube(p,'Lantern ground stake',[(0,0,0),(0,.68,0)],.038,WOOD,sides=10)
    lathe(p,'Lantern foot tray',[(0,.64),(.21,.64),(.25,.67),(.23,.71),(0,.71)],'#9b7652',n=24)
    for j in range(6):
        a=TAU*j/6
        tube(p,'Hexagonal lantern frame',[(.205*math.cos(a),.68,.205*math.sin(a)),(.223*math.cos(a),.91,.223*math.sin(a)),(.20*math.cos(a),1.16,.20*math.sin(a))],.016,WOOD,sides=6)
    for y in (.72,1.14):
        ring(p,'Lantern frame band',(0,y,0),.21,.21,.019,'#cfab6a',n=24,sides=6)
    lathe(p,'Sloped lantern canopy',[(0,1.14),(.25,1.14),(.25,1.18),(.09,1.265),(0,1.275)],'#b88a55',n=24)
    ring(p,'Lantern hanging loop',(0,1.28,0),.044,.044,.012,'#9b7652',True,n=20,sides=6)
    orb(p,'Dimensional amber firefly light',(0,.92,0),(.093,.155,.093),'#f7dc8b','satin',n=16,rings=8)
    for j in range(4):
        a=TAU*j/4
        orb(p,'Firefly spark',(.115*math.cos(a),.86+.055*j,.115*math.sin(a)),(.016,.022,.016),'#fff1b3','satin',n=8,rings=4)


def watering_can():
    p='watering-can'
    vessel(p,'Hollow watering can body',.25,-.215,.215,TEAL)
    ring(p,'Rolled open can rim',(0,.21,0),.231,.231,.015,'#8bb6bf',n=32)
    # Hollow tapered spout is a closed wall profile along an angled axis.
    ob=lathe(p,'Hollow tapered pouring spout',[(.065,0),(.069,.04),(.046,.52),(.057,.55),(.048,.56),(.035,.535),(.051,.04),(.055,0),(.065,0)],TEAL,'satin',n=20)
    rotation=Vector((0,1,0)).rotation_difference(Vector((.80,.60,0)))
    for v in ob.data.vertices:
        q=rotation@Vector(yup(v.co))+Vector((.16,-.04,0))
        v.co=xyz(q)
    tube(p,'Open side carry handle',[(-.17,.15,0),(-.35,.21,0),(-.45,.17,0),(-.46,.02,0),(-.37,-.12,0),(-.18,-.12,0)],.028,TEAL,sides=10)
    ring(p,'Can base seam',(0,-.18,0),.187,.187,.010,'#507f8d',n=32)


def sun():
    p='sunlight-token'
    orb(p,'Convex golden sun medallion',(0,0,0),(.32,.32,.14),'#edbf56','satin',n=32,rings=12)
    ring(p,'Raised sun face bezel',(0,0,.073),.291,.291,.016,'#f7d77d',True,n=40,role='satin')
    for j in range(8):
        a=TAU*j/8
        d=Vector((math.cos(a),math.sin(a),0)); side=Vector((-math.sin(a),math.cos(a),0))
        outline=[d*.30-side*.042,d*.48-side*.055,d*.58,d*.48+side*.055,d*.30+side*.042]
        v=[(q.x,q.y,z) for z in (-.035,.035) for q in outline]
        mesh(p,'Bevelled dimensional sun ray',v,[(4,3,2,1,0),(5,6,7,8,9)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)],'#e5b34d','satin',smooth=False,bevel=.007)


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
    for role,roughness in (('matte',.82),('satin',.32)):
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
    root['authoring']='Original deterministic geometry; no images, previews, or render operations'
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
