"""Read the shipped GLB's real binary accessors; no Blender or image dependency."""
from collections import Counter
from pathlib import Path
import hashlib
import json
import math
import struct

HERE=Path(__file__).resolve().parent
GLB=HERE.parents[1]/'public/models/props-korean.glb'
IDS=('moon-chair','dandelion-pot','tiny-pond','cloud-balloon','reading-cat',
     'rainbow-flag','picnic-basket','strawberry-patch','mushroom-home',
     'bird-bath','pebble-fountain','firefly-lantern','watering-can','sunlight-token')


def sub(a,b):
    return tuple(x-y for x,y in zip(a,b))


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def dot(a,b):
    return sum(x*y for x,y in zip(a,b))


def length(a):
    return math.sqrt(dot(a,a))


def bounds(points):
    low=[min(p[i] for p in points) for i in range(3)]
    high=[max(p[i] for p in points) for i in range(3)]
    return {'min':low,'max':high,'size':list(sub(high,low))}


def topology(points,triangles):
    lookup,remap,unique={},[],[]
    for p in points:
        key=tuple(round(v,7) for v in p)
        if key not in lookup:
            lookup[key]=len(unique); unique.append(p)
        remap.append(lookup[key])
    edges=Counter(); graph=[set() for _ in unique]
    for t in triangles:
        a,b,c=[remap[i] for i in t]
        for i,j in ((a,b),(b,c),(c,a)):
            edges[tuple(sorted((i,j)))]+=1
            graph[i].add(j); graph[j].add(i)
    unseen=set(range(len(unique))); components=[]
    while unseen:
        stack=[unseen.pop()]; found=[]
        while stack:
            v=stack.pop(); found.append(v)
            fresh=graph[v]&unseen
            unseen.difference_update(fresh); stack.extend(fresh)
        components.append({'vertices':len(found),'bounds':bounds([unique[i] for i in found])})
    return {'welded_vertices':len(unique),'boundary_edges':sum(n==1 for n in edges.values()),
            'nonmanifold_edges':sum(n>2 for n in edges.values()),
            'components':sorted(components,key=lambda c:-c['vertices'])}


def verify():
    baseline=json.loads((HERE/'baseline-bounds.json').read_text())['bounds']
    assert set(baseline)==set(IDS)
    raw=GLB.read_bytes()
    assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
    offset=12; chunks={}
    while offset<len(raw):
        size,kind=struct.unpack_from('<II',raw,offset)
        assert size%4==0 and offset+8+size<=len(raw) and kind not in chunks
        chunks[kind]=raw[offset+8:offset+8+size]; offset+=8+size
    assert offset==len(raw) and set(chunks)=={0x4e4f534a,0x004e4942}
    doc=json.loads(chunks[0x4e4f534a]); binary=chunks[0x004e4942]
    assert len(doc['buffers'])==1 and 'uri' not in doc['buffers'][0]
    assert len(binary)-3<=doc['buffers'][0]['byteLength']<=len(binary)
    for key in ('images','textures','cameras','animations','skins'):
        assert not doc.get(key),key
    assert not doc.get('extensionsRequired')
    assert not doc.get('extensions',{}).get('KHR_lights_punctual')

    def values(index):
        acc=doc['accessors'][index]; view=doc['bufferViews'][acc['bufferView']]
        assert not acc.get('sparse') and view.get('buffer',0)==0
        count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[acc['type']]
        fmt,width={5121:('B',1),5123:('H',2),5125:('I',4),5126:('f',4)}[acc['componentType']]
        stride=view.get('byteStride',count*width)
        start=view.get('byteOffset',0)+acc.get('byteOffset',0)
        assert acc['count']>0 and start+(acc['count']-1)*stride+count*width<=view.get('byteOffset',0)+view['byteLength']<=len(binary)
        rows=[struct.unpack_from('<'+fmt*count,binary,start+i*stride) for i in range(acc['count'])]
        if acc.get('normalized'):
            rows=[tuple(v/((1<<(width*8))-1) for v in row) for row in rows]
        assert all(math.isfinite(v) for row in rows for v in row)
        return rows

    nodes={n['name']:n for n in doc['nodes']}
    assert len(nodes)==len(doc['nodes'])==29
    assert set(nodes)=={'korean-props',*IDS,*[p+'-mesh' for p in IDS]}
    root=nodes['korean-props']; ri=doc['nodes'].index(root)
    assert doc['scenes'][doc.get('scene',0)]['nodes']==[ri]
    assert len(root['children'])==14 and {doc['nodes'][i]['name'] for i in root['children']}==set(IDS)
    for name,n in nodes.items():
        assert 'matrix' not in n,name
        for k,wanted in (('translation',[0,0,0]),('scale',[1,1,1]),('rotation',[0,0,0,1])):
            assert len(n.get(k,wanted))==len(wanted) and max(abs(a-b) for a,b in zip(n.get(k,wanted),wanted))<1e-7,(name,k,n.get(k))
        assert 'camera' not in n and not n.get('extensions',{}).get('KHR_lights_punctual')
    total_tri,total_verts,total_prims=0,0,0
    report={}
    for part in IDS:
        group=nodes[part]
        assert 'mesh' not in group and len(group['children'])==1
        node=doc['nodes'][group['children'][0]]
        assert node['name']==part+'-mesh' and not node.get('children')
        prims=doc['meshes'][node['mesh']]['primitives']
        assert 1<=len(prims)<=3
        all_p,all_t=[],[]
        tri_count=0; attr_report=[]
        for prim in prims:
            assert prim.get('mode',4)==4 and not prim.get('targets')
            attrs=prim['attributes']
            assert {'POSITION','NORMAL','TEXCOORD_0','COLOR_0'}<=attrs.keys()
            p,n,uv,c=[values(attrs[k]) for k in ('POSITION','NORMAL','TEXCOORD_0','COLOR_0')]
            assert len(p)==len(n)==len(uv)==len(c)
            indices=[v[0] for v in values(prim['indices'])]
            assert len(indices)%3==0 and 0<=min(indices)<=max(indices)<len(p)
            triangles=list(zip(indices[::3],indices[1::3],indices[2::3]))
            nl=list(map(length,n)); assert max(abs(v-1) for v in nl)<2e-5,(part,'normals')
            assert all(0<=v<=1 for row in c for v in row)
            assert all(len(row)==3 or abs(row[3]-1)<1e-6 for row in c)
            assert len({tuple(round(v,5) for v in row[:3]) for row in c})>=1
            uv_span=[max(v[i] for v in uv)-min(v[i] for v in uv) for i in range(2)]
            assert min(uv_span)>1e-3,(part,'collapsed UV range')
            areas=[]; uv_areas=[]; winding=[]
            for a,b,d in triangles:
                normal=cross(sub(p[b],p[a]),sub(p[d],p[a])); norm=length(normal)
                areas.append(norm/2)
                u,v=sub(uv[b],uv[a]),sub(uv[d],uv[a])
                uv_areas.append(abs(u[0]*v[1]-u[1]*v[0])/2)
                winding.append(dot(normal,tuple(n[a][i]+n[b][i]+n[d][i] for i in range(3)))/max(norm,1e-30))
            assert min(areas)>1e-12,(part,'degenerate geometry',min(areas))
            assert min(uv_areas)>1e-13,(part,'degenerate UV',min(uv_areas))
            assert min(winding)>-1e-5,(part,'inverted normals',min(winding))
            first=len(all_p); all_p.extend(p); all_t.extend(tuple(i+first for i in t) for t in triangles)
            tri_count+=len(triangles)
            attr_report.append({'material':prim['material'],'vertices':len(p),'triangles':len(triangles),
                'attributes':sorted(attrs),'normal_length_range':[min(nl),max(nl)],'uv_span':uv_span,
                'minimum_triangle_area':min(areas),'minimum_uv_triangle_area':min(uv_areas),
                'minimum_winding_normal_agreement':min(winding),
                'linear_color_min':[min(row[i] for row in c) for i in range(3)],
                'linear_color_max':[max(row[i] for row in c) for i in range(3)]})
        box=bounds(all_p)
        error=max(abs(box[k][i]-baseline[part][k][i]) for k in ('min','max') for i in range(3))
        assert error<2e-6,(part,'bounds',error)
        assert tri_count<=(8000 if part=='reading-cat' else 3500),(part,tri_count)
        topo=topology(all_p,all_t)
        assert topo['boundary_edges']==topo['nonmanifold_edges']==0,(part,'closed manifold components',topo)
        report[part]={'pivot':[0,0,0],'identity':True,'bounds':box,'baseline_max_error':error,
            'triangles':tri_count,'vertices':len(all_p),'primitives':len(prims),'attributes':attr_report,
            'features':group['extras']['features'],'baseline_fit_scale':group['extras']['baseline_fit_scale'],
            'topology':topo}
        total_tri+=tri_count; total_verts+=len(all_p); total_prims+=len(prims)
    assert len(doc['meshes'])==14 and len(doc['materials'])<=3
    for mat in doc['materials']:
        pbr=mat['pbrMetallicRoughness']
        assert pbr.get('baseColorFactor',[1]*4)==[1]*4
        assert pbr.get('metallicFactor',1)==0 and 0<pbr['roughnessFactor']<=1
        assert mat.get('alphaMode','OPAQUE')=='OPAQUE'
        assert not any('Texture' in k for k in pbr)
        assert not mat.get('normalTexture') and not mat.get('emissiveTexture')
    assert total_tri<=65000 and len(raw)<=5000000
    target_count=sum(r['triangles']<=3500 for p,r in report.items() if p!='reading-cat')
    assert target_count>=10,('most parts triangle target',target_count)
    core=report['reading-cat']['topology']['components'][0]
    assert core['vertices']>=320 and core['bounds']['size'][1]>.95,('cat connected body/head',core)
    blend=HERE/'props-korean.blend'
    assert blend.is_file() and not list(HERE.glob('*.blend[0-9]*'))
    result={'status':'PASS','blender_version':root['extras']['blender_version'],
        'glb_path':str(GLB),'blend_path':str(blend),'glb_bytes':len(raw),'blend_bytes':blend.stat().st_size,
        'triangles':total_tri,'exported_vertices':total_verts,'primitives':total_prims,'materials':len(doc['materials']),
        'direct_identity_groups':14,'nodes':29,'non_cat_parts_at_or_below_3500':target_count,
        'maximum_bounds_error':max(r['baseline_max_error'] for r in report.values()),
        'glb_sha256':hashlib.sha256(raw).hexdigest(),'blend_sha256':hashlib.sha256(blend.read_bytes()).hexdigest(),
        'source_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (HERE/'build_props_korean.py',Path(__file__))},
        'budgets':{'triangles_hard_max':65000,'bytes_hard_max':5000000,'materials_max':3,
            'primitives_per_part_max':3,'non_cat_triangles_target':3500,'cat_triangles_max':8000},
        'coordinate_system':{'up':'+Y','front':'+Z','root_identity':True,'part_origins':[0,0,0]},
        'parts':report,'excluded':{'images':0,'textures':0,'cameras':0,'lights':0,'animations':0,'external_buffers':0},
        'assumptions':['Baseline bounds are exact per-axis vertex fits, not object scaling.',
            'All 14 parts intentionally overlap at local origin; placement and care motion remain runtime responsibilities.',
            'Two shared opaque vertex-color surfaces: matte .82 and satin .32; water and firefly use geometry/color, not transparency or lights.',
            'Cat body, neck and head are one continuous closed loft; ears, paws, tail and book are authored attached features.',
            'UVs use nondegenerate per-triangle dominant-axis projection with intentional overlapping islands; no textures.',
            'No visual evaluation, images, previews, or renders were generated or inspected.']}
    (HERE/'asset-report.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:result[k] for k in ('status','blender_version','glb_bytes','triangles','primitives','materials','maximum_bounds_error')}))
    return result


if __name__=='__main__':
    verify()
