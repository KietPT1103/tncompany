import { useState } from "react";
import type { InvoiceEntryEvidence } from "@/services/invoiceEntryService";

export default function InvoiceLinkedEvidence({evidence}:{evidence:InvoiceEntryEvidence}) {
  const [failed,setFailed]=useState(false);
  const drive=evidence.fileUrl.match(/^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view$/);
  const thumbnail=drive?`https://drive.google.com/thumbnail?id=${encodeURIComponent(drive[1])}&sz=w320`:evidence.fileUrl;
  const isImage=!!drive || /\.(?:png|jpe?g|webp|gif)(?:[?#]|$)/i.test(evidence.fileUrl);
  return <a href={evidence.fileUrl} target="_blank" rel="noreferrer" className="block text-sm text-sky-700 hover:text-sky-900">
    {isImage && !failed && <img src={thumbnail} alt="Ảnh bill minh chứng" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} className="mb-1 max-h-28 max-w-40 rounded-md border object-contain"/>}
    <span className="underline">{evidence.originalName}</span>
  </a>;
}
