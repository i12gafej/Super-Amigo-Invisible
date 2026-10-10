import {ApiError} from './validation.ts';

// PostgREST devuelve un cuerpo vacío para las funciones que retornan void.
export async function readDatabaseResponse<T>(response:Response):Promise<T>{
 const body=await response.text();
 if(!body.trim())return null as T;
 try{return JSON.parse(body) as T;}
 catch{throw new ApiError(503,'La base de datos devolvió una respuesta inválida. Inténtalo de nuevo.');}
}
