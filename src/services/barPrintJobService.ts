import { ApiTimestamp, posRequest, subscribeByPolling } from "@/services/posApi";
export type BarPrintJobStatus="pending"|"printed";
export type BarWorkflowStatus="new"|"preparing"|"ready"|"collected";
export type BarPrintJobItem={menuId:string;name:string;price:number;quantity:number;note?:string};
export type BarPrintJob={id:string;storeId:string;tableNumber:string;sourceBillId?:string;items:BarPrintJobItem[];createdById?:string;createdByName?:string;status:BarPrintJobStatus;workflowStatus:BarWorkflowStatus;createdAt?:ApiTimestamp;workflowUpdatedAt?:ApiTimestamp;collectedAt?:ApiTimestamp;printedAt?:ApiTimestamp;printedByTerminal?:string};
export type NewBarPrintJob={storeId:string;tableNumber:string;sourceBillId?:string;items:BarPrintJobItem[];createdById?:string;createdByName?:string};
const load=async(storeId:string)=>(await posRequest<{items:BarPrintJob[]}>("bar-jobs",{},{storeId})).items;
const loadBoard=async(storeId:string)=>(await posRequest<{items:BarPrintJob[]}>("bar-jobs",{},{storeId,view:"board"})).items;
export const subscribePendingBarPrintJobs=(storeId:string,onChange:(jobs:BarPrintJob[])=>void,onError?:(error:Error)=>void)=>subscribeByPolling(()=>load(storeId),onChange,onError);
export const subscribeBarBoard=(storeId:string,onChange:(jobs:BarPrintJob[])=>void,onError?:(error:Error)=>void)=>subscribeByPolling(()=>loadBoard(storeId),onChange,onError);
export async function createBarPrintJob(data:NewBarPrintJob){return(await posRequest<{id:string}>("bar-jobs",{method:"POST",body:JSON.stringify(data)})).id;}
export async function markBarPrintJobPrinted(id:string,terminalName?:string){await posRequest("bar-jobs",{method:"PATCH",body:JSON.stringify({id,terminalName})});}
export async function updateBarWorkflowStatus(id:string,workflowStatus:BarWorkflowStatus,storeId:string){await posRequest("bar-jobs",{method:"PATCH",body:JSON.stringify({id,workflowStatus})},{storeId});}
