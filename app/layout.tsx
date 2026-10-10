import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'SUPER AMIGO INVISIBLE',description:'El regalo es secreto. El lío, opcional.',manifest:'/manifest.webmanifest',robots:{index:false,follow:false},appleWebApp:{capable:true,title:'Super Amigo'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#5124bc'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}
