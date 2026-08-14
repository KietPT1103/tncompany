import { ApiTimestamp, posRequest, subscribeByPolling } from "@/services/posApi";
export type KitchenPrintJobStatus="pending"|"printed";
export type KitchenPrintJobItem={menuId:string;name:string;price:number;quantity:number;note?:string};
export type KitchenPrintJob={id:string;storeId:string;orderKey:string;tableNumber:string;items:KitchenPrintJobItem[];createdById?:string;createdByName?:string;status:KitchenPrintJobStatus;createdAt?:ApiTimestamp;printedAt?:ApiTimestamp;printedByTerminal?:string};
export type NewKitchenPrintJob={storeId:string;orderKey:string;tableNumber:string;items:KitchenPrintJobItem[];createdById?:string;createdByName?:string};
const load=async(storeId:string)=>(await posRequest<{items:KitchenPrintJob[]}>("kitchen-jobs",{},{storeId})).items;
export const subscribePendingKitchenPrintJobs=(storeId:string,onChange:(jobs:KitchenPrintJob[])=>void,onError?:(error:Error)=>void)=>subscribeByPolling(()=>load(storeId),onChange,onError);
export async function createKitchenPrintJob(data:NewKitchenPrintJob){return(await posRequest<{id:string}>("kitchen-jobs",{method:"POST",body:JSON.stringify(data)})).id;}
export async function markKitchenPrintJobPrinted(id:string,terminalName?:string){await posRequest("kitchen-jobs",{method:"PATCH",body:JSON.stringify({id,terminalName})});}
