// The inline script on "/". It runs while the page is parsed, before any Next bundle arrives:
// saved choice, then the browser's language list, then English, then location.replace() so Back
// does not return to "/". It also saves a deliberate pick when one of the four links is clicked.
// It is plain ES5 and is a string, so the unit test runs the exact text that ships.
import { defaultLocale, locales } from "@/config/locales";
import { STORAGE_KEY } from "@/lib/locale-choice";

export const JUMP_SCRIPT = `(function(){
var L=${JSON.stringify(locales)},K=${JSON.stringify(STORAGE_KEY)};
document.addEventListener("click",function(e){
var t=e.target;
while(t&&t!==document){
var c=t.getAttribute&&t.getAttribute("data-locale");
if(c){if(L.indexOf(c)>=0){try{localStorage.setItem(K,c)}catch(x){}}return}
t=t.parentNode}
});
if(location.hash==="#choose")return;
var s=null;
try{s=localStorage.getItem(K)}catch(x){}
if(L.indexOf(s)<0){
s=null;
var n=navigator.languages;
if(!n||!n.length)n=[navigator.language];
for(var i=0;i<n.length;i++){
var p=String(n[i]||"").split("-")[0].toLowerCase();
if(L.indexOf(p)>=0){s=p;break}
}
}
if(!s)s=${JSON.stringify(defaultLocale)};
location.replace("/"+s+"/");
})();`;
