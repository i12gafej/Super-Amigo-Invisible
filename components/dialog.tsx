'use client';
import {useEffect,useRef} from 'react';
export function Dialog({titleId,onClose,children}:{titleId:string;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLElement>(null),closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
 const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
 document.body.style.overflow='hidden';
 const focusable=()=>Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]);
 (focusable()[0]||ref.current)?.focus();
 function onKey(e:KeyboardEvent){if(e.key==='Escape'){closeRef.current();return;}if(e.key!=='Tab')return;const list=focusable(),first=list[0],last=list[list.length-1];if(!first){e.preventDefault();return;}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 document.addEventListener('keydown',onKey);
 return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',onKey);previous?.focus();};
 },[]);
 return <div className="modal-backdrop"><section ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>{children}</section></div>;
}
