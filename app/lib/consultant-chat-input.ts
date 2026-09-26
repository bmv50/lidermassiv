export const CHAT_INPUT_LIMIT=1200;
export const CHAT_CONTEXT_MESSAGES=11;
export type ChatMessage={role:'user'|'assistant';content:string;productIds?:string[]};
export const personalDataHint='Для демонстрации не вводите телефон, email, адрес или другие личные данные. Опишите мебель без контактов.';
// A best-effort contact guard, not a guarantee that all personal data is detected.
export function containsContact(text:string):boolean {
  return /[\w.+-]+@[\w.-]+\.[a-zа-я]{2,}/iu.test(text)
    || /(?:\+?7|8)(?:[\s().-]*\d){10}(?!\d)/u.test(text);
}
export function parseChat(value:unknown):ChatMessage[] {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).join(',')!=='messages')throw Error('invalid_request');
  const messages=(value as {messages:unknown}).messages;
  if(!Array.isArray(messages)||!messages.length||messages.length>CHAT_CONTEXT_MESSAGES||messages.length%2!==1)throw Error('invalid_request');
  let length=0;
  return messages.map((message,index)=>{
    if(!message||typeof message!=='object'||Array.isArray(message))throw Error('invalid_request');
    const {role,content,productIds}=message;
    if(Object.keys(message).some(k=>!['role','content','productIds'].includes(k))
      ||role!==(index%2===0?'user':'assistant')||typeof content!=='string'||!content.trim()
      ||content.length>(role==='user'?CHAT_INPUT_LIMIT:2400))throw Error('invalid_request');
    length+=content.length;if(length>10000)throw Error('invalid_request');
    if(containsContact(content))throw Error('personal_data');
    if(productIds!==undefined&&(role!=='assistant'||!Array.isArray(productIds)||productIds.length>3||productIds.some(id=>typeof id!=='string'||!/^[\w-]{1,80}$/.test(id))))throw Error('invalid_request');
    return {role,content:content.trim(),...(productIds?{productIds:[...new Set(productIds)] as string[]}: {})};
  });
}
