import { apiRequest } from '@/lib/api';

export type InventoryOverviewItem={ingredientId:string;ingredientCode:string;ingredientName:string;unit:string;cost:number|null;warehouseQuantity:number;counterBookQuantity:number;openingCounterQuantity:number|null;expectedCounterQuantity:number;issuedQuantity:number;usedQuantity:number;actualCounterQuantity:number|null;lossQuantity:number|null;lossPercent:number|null;warehouseValue:number|null;counterValue:number|null};
export type InventoryOverview={items:InventoryOverviewItem[];totals:{warehouseQuantity:number;counterQuantity:number;usedQuantity:number;usedValue:number;lossQuantity:number;lossPercent:number|null;warehouseValue:number;counterValue:number;lossValue:number};dateFrom:string;dateTo:string;isAdmin:boolean;latestCountDate:string|null;openingCountDate:string|null;canCalculateLoss:boolean;lossMessage:string|null;recipeErrors:string[]};

export function getInventoryOverview(storeId:string,dateFrom:string,dateTo:string){
 const query=new URLSearchParams({storeId,dateFrom,dateTo});
 return apiRequest<InventoryOverview>(`/inventory-overview.php?${query}`);
}
export function saveCounterCount(payload:{storeId:string;countDate:string;note?:string;items:Array<{ingredientId:string;actualQuantity:number}>}){
 return apiRequest<{id:string}>('/inventory-overview.php',{method:'POST',body:JSON.stringify(payload)});
}
