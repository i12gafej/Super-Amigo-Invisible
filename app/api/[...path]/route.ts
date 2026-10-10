import {NextResponse,type NextRequest} from 'next/server';
import {dispatch} from '@/lib/server';
import {ApiError} from '@/lib/database';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:Promise<{path:string[]}>}){
 const headers={'Cache-Control':'no-store, private','Pragma':'no-cache','Vary':'Cookie'};
 try{
 const origin=process.env.APP_ORIGIN;if(!origin)throw new ApiError(503,'La aplicación real no está configurada. Puedes probar /demo.');
 if(request.headers.get('origin')!==new URL(origin).origin)throw new ApiError(403,'Origen de solicitud no autorizado.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError(415,'Se requiere JSON.');
 const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'Solicitud vacía.');let bytes=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>32768){await reader.cancel();throw new ApiError(413,'Solicitud demasiado grande.');}chunks.push(value);}
 let data:unknown;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ApiError(400,'JSON inválido.');}if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError(400,'Solicitud inválida.');
 const {path}=await params;return NextResponse.json(await dispatch(path.join('/'),data as Record<string,unknown>),{headers});
 }catch(e){return NextResponse.json({error:e instanceof ApiError?e.message:'No se pudo completar la operación. Revisa la configuración del servidor.'},{status:e instanceof ApiError?e.status:500,headers});}
}
