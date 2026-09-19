import {initializeApp} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {getFirestore,collection,onSnapshot,addDoc,updateDoc,deleteDoc,doc,serverTimestamp,query,orderBy} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig={
  apiKey:"AIzaSyAm-MW_9w6eoMnOASvCW4Nggnoqt-zYJUM",
  authDomain:"almajedi-store.firebaseapp.com",
  projectId:"almajedi-store",
  storageBucket:"almajedi-store.firebasestorage.app",
  messagingSenderId:"344756581138",
  appId:"1:344756581138:web:e08507b0bc410b3d32b9cb"
};
const ADMIN_UID="p9dDm9zvL5brYUsoli4QBLAqiaL2";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);

const definitions={
  products:{title:"المنتجات",hint:"إضافة وتعديل منتجات المتجر",singular:"منتج",fields:[
    ["name","اسم المنتج","text",true],["price","السعر","number",true],["currency","العملة","select",true,["ر.س","ر.ي"]],
    ["category","القسم","text",true],["condition","الحالة","select",true,["جديد","مستخدم"]],["imageUrl","رابط الصورة","url",false],
    ["specs","المواصفات","textarea",false],["description","الوصف","textarea",false]
  ]},
  offers:{title:"العروض",hint:"إدارة العروض والخصومات",singular:"عرض",fields:[
    ["name","عنوان العرض","text",true],["price","سعر العرض","number",false],["oldPrice","السعر السابق","number",false],
    ["imageUrl","رابط صورة العرض","url",false],["description","تفاصيل العرض","textarea",false],["endsAt","تاريخ انتهاء العرض","date",false]
  ]},
  categories:{title:"الأقسام",hint:"تنظيم أقسام التطبيق",singular:"قسم",fields:[
    ["name","اسم القسم","text",true],["icon","الرمز أو الإيموجي","text",false],["imageUrl","رابط الصورة","url",false],["description","وصف مختصر","textarea",false]
  ]},
  services:{title:"الخدمات",hint:"إدارة خدمات الصيانة والبرمجة",singular:"خدمة",fields:[
    ["name","اسم الخدمة","text",true],["icon","الرمز أو الإيموجي","text",false],["imageUrl","رابط الصورة","url",false],["description","تفاصيل الخدمة","textarea",false]
  ]},
  banners:{title:"الواجهات",hint:"إدارة صور وعبارات واجهة التطبيق",singular:"واجهة",fields:[
    ["name","عنوان الواجهة","text",true],["subtitle","العبارة الفرعية","text",false],["imageUrl","رابط الصورة","url",false],["buttonText","نص الزر","text",false]
  ]}
};

let currentCollection="products",records=[],unsubscribe=null;
const $=s=>document.querySelector(s),loginView=$("#loginView"),adminView=$("#adminView"),items=$("#items"),loading=$("#loading"),dialog=$("#editorDialog");
const escapeHtml=value=>String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
function friendlyError(error){const code=error?.code||"";if(code.includes("invalid-credential"))return"البريد الإلكتروني أو كلمة المرور غير صحيحة";if(code.includes("too-many-requests"))return"محاولات كثيرة، انتظر قليلاً ثم حاول";if(code.includes("permission-denied"))return"ليست لديك صلاحية لتنفيذ هذا الإجراء";return"حدث خطأ، تحقق من الإنترنت وحاول مجدداً"}

$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();$("#loginError").textContent="";const button=e.currentTarget.querySelector("button");button.disabled=true;button.textContent="جاري الدخول…";try{await signInWithEmailAndPassword(auth,$("#email").value.trim(),$("#password").value)}catch(error){$("#loginError").textContent=friendlyError(error)}finally{button.disabled=false;button.textContent="تسجيل الدخول"}});
$("#logoutButton").onclick=()=>signOut(auth);
onAuthStateChanged(auth,user=>{const allowed=user&&user.uid===ADMIN_UID;loginView.classList.toggle("hidden",allowed);adminView.classList.toggle("hidden",!allowed);if(user&&!allowed){signOut(auth);$("#loginError").textContent="هذا الحساب غير مصرح له بالدخول"}if(allowed)subscribe()});

function subscribe(){if(unsubscribe)unsubscribe();loading.classList.remove("hidden");items.innerHTML="";let source;try{source=query(collection(db,currentCollection),orderBy("createdAt","desc"))}catch{source=collection(db,currentCollection)}unsubscribe=onSnapshot(source,snapshot=>{records=snapshot.docs.map(d=>({id:d.id,...d.data()}));loading.classList.add("hidden");render()},error=>{loading.textContent=friendlyError(error);loading.classList.remove("hidden")})}
function render(){const term=$("#searchInput").value.trim().toLowerCase();const visible=records.filter(x=>(x.name||"").toLowerCase().includes(term));$("#itemCount").textContent=records.length;$("#activeCount").textContent=records.filter(x=>x.isActive!==false).length;if(!visible.length){items.innerHTML=`<div class="empty">${records.length?"لا توجد نتائج مطابقة":"لا توجد عناصر بعد — اضغط إضافة جديد"}</div>`;return}items.innerHTML=visible.map(x=>`<article class="item">${x.imageUrl?`<img class="item-image" src="${escapeHtml(x.imageUrl)}" alt="" loading="lazy">`:`<div class="item-image fallback">${escapeHtml(x.icon||"◆")}</div>`}<div><h3>${escapeHtml(x.name||"بدون اسم")}</h3><p>${escapeHtml(summary(x))}</p><span class="status ${x.isActive===false?"off":""}">${x.isActive===false?"مخفي":"ظاهر"}</span></div><div class="item-actions"><button data-edit="${x.id}">تعديل</button><button class="delete" data-delete="${x.id}">حذف</button></div></article>`).join("");items.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEditor(records.find(x=>x.id===b.dataset.edit)));items.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>removeRecord(b.dataset.delete))}
function summary(x){if(currentCollection==="products")return`${x.price??"—"} ${x.currency||"ر.س"} • ${x.condition||x.category||""}`;return x.description||x.subtitle||""}

$("#tabs").onclick=e=>{const button=e.target.closest("[data-collection]");if(!button)return;currentCollection=button.dataset.collection;document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("active",b===button));const def=definitions[currentCollection];$("#sectionTitle").textContent=def.title;$("#sectionHint").textContent=def.hint;$("#searchInput").value="";subscribe()};
$("#searchInput").oninput=render;$("#addButton").onclick=()=>openEditor();$("#closeDialog").onclick=()=>dialog.close();$("#cancelButton").onclick=()=>dialog.close();
function openEditor(record=null){const def=definitions[currentCollection];$("#dialogTitle").textContent=(record?"تعديل ":"إضافة ")+def.singular;$("#documentId").value=record?.id||"";$("#isActive").checked=record?.isActive!==false;$("#formError").textContent="";$("#formFields").innerHTML=def.fields.map(([key,label,type,required,options])=>{const value=record?.[key]??"",full=type==="textarea"?"full":"";if(type==="textarea")return`<label class="${full}">${label}<textarea name="${key}" ${required?"required":""}>${escapeHtml(value)}</textarea></label>`;if(type==="select")return`<label>${label}<select name="${key}" ${required?"required":""}><option value="">اختر</option>${options.map(o=>`<option value="${escapeHtml(o)}" ${value===o?"selected":""}>${escapeHtml(o)}</option>`).join("")}</select></label>`;return`<label class="${key==="imageUrl"?"full":""}">${label}<input name="${key}" type="${type}" value="${escapeHtml(value)}" ${required?"required":""}></label>`}).join("");dialog.showModal()}

$("#editorForm").addEventListener("submit",async e=>{e.preventDefault();const button=e.currentTarget.querySelector('[type="submit"]');button.disabled=true;button.textContent="جاري الحفظ…";$("#formError").textContent="";const form=new FormData(e.currentTarget),data={isActive:$("#isActive").checked,updatedAt:serverTimestamp()};definitions[currentCollection].fields.forEach(([key,,type])=>{let value=String(form.get(key)||"").trim();data[key]=type==="number"&&value!==""?Number(value):value});try{const id=$("#documentId").value;if(id)await updateDoc(doc(db,currentCollection,id),data);else await addDoc(collection(db,currentCollection),{...data,createdAt:serverTimestamp()});dialog.close();toast("تم حفظ التغييرات بنجاح")}catch(error){$("#formError").textContent=friendlyError(error)}finally{button.disabled=false;button.textContent="حفظ التغييرات"}});
async function removeRecord(id){const record=records.find(x=>x.id===id);if(!confirm(`هل تريد حذف «${record?.name||"هذا العنصر"}»؟`))return;try{await deleteDoc(doc(db,currentCollection,id));toast("تم حذف العنصر")}catch(error){toast(friendlyError(error))}}
