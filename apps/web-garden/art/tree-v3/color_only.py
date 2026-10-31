"""Transfer authored COLOR_0 only, preserving every published v2 non-color byte."""
from pathlib import Path
import hashlib,json,struct
FORMAT={5126:'f',5123:'H',5125:'I',5121:'B'}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def load(path):
 raw=bytearray(Path(path).read_bytes());size=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+size]);return raw,data,28+size
def values(raw,data,base,index):
 a=data['accessors'][index];v=data['bufferViews'][a['bufferView']];fmt='<'+FORMAT[a['componentType']]*WIDTH[a['type']];size=struct.calcsize(fmt);stride=v.get('byteStride',size);start=base+v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from(fmt,raw,start+i*stride) for i in range(a['count'])],start,stride,size

def preserve_geometry(baseline,candidate):
 old,j,b=load(baseline);new,k,c=load(candidate);out=bytearray(old);spans=[];count=0
 assert hashlib.sha256(old).hexdigest()=='556268ada2bb9c74afd06352bfded94c9981c26c27209afe6392f6cdbf88a0ba','Published v2 reference changed'
 byname={m['name']:m for m in k['meshes']}
 for mesh in j['meshes']:
  other=byname[mesh['name']];assert len(mesh['primitives'])==len(other['primitives'])
  for a,z in zip(mesh['primitives'],other['primitives']):
   original,offset,stride,size=values(old,j,b,a['attributes']['COLOR_0']);revised,noff,nstride,nsize=values(new,k,c,z['attributes']['COLOR_0']);assert size==nsize
   oa=[values(old,j,b,a['attributes'][name])[0] for name in ('POSITION','NORMAL','TEXCOORD_0')]
   na=[values(new,k,c,z['attributes'][name])[0] for name in ('POSITION','NORMAL','TEXCOORD_0')]
   if oa==na:indices=list(range(len(original)))
   else:
    keys=lambda arrays,i:tuple(round(v,6) for arr in arrays for v in arr[i])
    lookup={}
    for i in range(len(revised)):
     key=keys(na,i)
     if key in lookup:assert revised[lookup[key]]==revised[i],('ambiguous color',mesh['name'])
     lookup[key]=i
    indices=[lookup[keys(oa,i)] for i in range(len(original))]
   for i,idx in enumerate(indices):
    target=offset+i*stride;source=noff+idx*nstride;replacement=new[source:source+size]
    if old[target:target+size]!=replacement:count+=1
    out[target:target+size]=replacement;spans.append((target,target+size))
 # Validate complete binary, not just a permissive numeric-tolerance comparison.
 protected=bytearray(out)
 for start,end in spans:protected[start:end]=old[start:end]
 assert protected==old,'A non-color byte was modified'
 assert out[:b]==old[:b],'JSON, materials or transforms changed'
 Path(candidate).write_bytes(out)
 report={'baseline_sha256':hashlib.sha256(old).hexdigest(),'output_sha256':hashlib.sha256(out).hexdigest(),'changed_color_vertices':count,'json_materials_nodes_transforms_identical':True,'all_non_color_binary_bytes_identical':True,'preserved_attributes':['POSITION','NORMAL','TEXCOORD_0','indices'],'bytes':len(out)}
 Path(__file__).resolve().parent.joinpath('color-only-report.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2));return report
