(this["webpackJsonpimp-app"]=this["webpackJsonpimp-app"]||[]).push([[0],{10:function(e,t,n){},12:function(e,t,n){"use strict";n.r(t);var i=n(1),c=n.n(i),s=n(4),a=n.n(s),r=(n(9),n(10),n(2)),o=n(0),l=Object(i.forwardRef)((function(e,t){return Object(i.useEffect)((function(){console.log(e.setID)}),[e.setID]),Object(o.jsx)("div",{id:"vis-panel",style:{minHeight:e.height},className:e.menuFocus?"noInteraction":"",children:e.filePath?Object(o.jsxs)(i.Fragment,{children:[Object(o.jsxs)("h3",{children:["Showing ",Object(o.jsxs)("span",{className:"fileNameString",children:[e.setID," "]})]}),Object(o.jsx)("span",{children:" Press [h] to view controls"}),Object(o.jsx)("iframe",{ref:t,seamless:!0,sandbox:"allow-same-origin allow-scripts allow-downloads",title:"Neuroglancer Viewer",id:"frame1",className:'"resized" '.concat(e.menuFocus?"noInteraction":""),src:e.filePath,style:{border:"none",width:"100%",height:"100%",minHeight:e.height-100}})]}):Object(o.jsx)("div",{className:"selectPrompt",children:" Please select a file "})})})),j=function(){var e=Object(i.useState)([]),t=Object(r.a)(e,2),n=t[0],c=t[1],s=Object(i.useState)([]),a=Object(r.a)(s,2),j=a[0],h=a[1],b=Object(i.useState)(),f=Object(r.a)(b,2),O=f[0],p=f[1],m=Object(i.useState)(),x=Object(r.a)(m,2),g=x[0],v=x[1],w=function(){var e=Object(i.useState)({width:void 0,height:void 0}),t=Object(r.a)(e,2),n=t[0],c=t[1];return Object(i.useEffect)((function(){function e(){c({width:window.innerWidth,height:window.innerHeight})}return window.addEventListener("resize",e),e(),function(){return window.removeEventListener("resize",e)}}),[]),n}(),N=Object(i.useRef)(),P=Object(i.createRef)(),S=Object(i.useState)(!0),F=Object(r.a)(S,2),L=F[0],I=F[1];Object(i.useEffect)((function(){var e="/IMP/data/Neuroglancer/idToUrlmapping.json";console.log("Fetching "+e),fetch(e,{headers:{"Content-Type":"application/json",Accept:"application/json"}}).then((function(e){return e.json()})).then((function(e){return h(e)})),document.addEventListener("mousedown",D)}),[]);var D=function(e){console.log(e.target),e.target.focus()},y=function(){I(!1)};return Object(o.jsxs)("div",{id:"root",className:"flex",children:[Object(o.jsxs)("div",{id:"menu",ref:N,onMouseEnter:function(){I(!0)},onMouseLeave:y,children:[Object(o.jsx)(d,{fileList:j,fileCallback:function(e){console.log(e);var t=j[e];p(t),c([e,t.url]),y(),fetch("/IMP/data/proteomics/"+e+".json",{headers:{"Content-Type":"application/json",Accept:"application/json"}}).then((function(e){return e.json()})).then((function(e){return v(e)}))},inputFile:n[1],fileData:O}),Object(o.jsx)(u,{proteinData:g})]}),Object(o.jsx)(l,{menuFocus:L,ref:P,setID:n[0],filePath:n[1],height:w.height})]})};var d=function(e){var t=e.fileList,n=e.fileCallback,c=e.fileData,s=Object(i.useRef)();return Object(o.jsxs)("aside",{className:"infoPanelSection",children:[Object(o.jsx)("h3",{children:"File"}),Object(o.jsx)("select",{className:"dropdown-medium",onChange:function(){n(s.current.value)},ref:s,children:Object.keys(t).map((function(e,t){return Object(o.jsx)("option",{value:e,children:e},"file"+t)}))}),c?Object(o.jsxs)("section",{id:"fileInfo",children:[Object(o.jsxs)("div",{className:"attributeRow",children:[Object(o.jsx)("span",{className:"attributeLabel",children:"File Size"}),Object(o.jsxs)("span",{className:"attributeValue",children:[c.size," ",c.unit," "]})]}),c.description?Object(o.jsxs)("div",{className:"attributeRow",children:[Object(o.jsx)("span",{className:"attributeLabel",children:" Description "}),Object(o.jsxs)("span",{className:"attributeValue",children:[c.description," "]})]}):""]}):""]})},u=function(e){var t=e.proteinData;return Object(o.jsxs)("aside",{className:"infoPanelSection",children:[Object(o.jsx)("h3",{children:"Proteomics"}),t?Object(o.jsxs)("table",{className:"proteinList",children:[Object(o.jsx)("thead",{children:Object(o.jsxs)("tr",{children:[Object(o.jsx)("th",{children:"Protein"}),Object(o.jsx)("th",{children:"#"}),Object(o.jsx)("th",{children:"Probability"})]})}),Object(o.jsx)("tbody",{children:t.map((function(e,t){return Object(o.jsxs)("tr",{className:"proteinListElement",value:e.name,children:[Object(o.jsx)("td",{children:e.name}),Object(o.jsx)("td",{children:e.num}),Object(o.jsx)("td",{children:e.probability})]},"file"+t)}))})]}):""]})};var h=function(){return Object(o.jsx)(j,{})},b=function(e){e&&e instanceof Function&&n.e(3).then(n.bind(null,13)).then((function(t){var n=t.getCLS,i=t.getFID,c=t.getFCP,s=t.getLCP,a=t.getTTFB;n(e),i(e),c(e),s(e),a(e)}))};a.a.render(Object(o.jsx)(c.a.StrictMode,{children:Object(o.jsx)(h,{})}),document.getElementById("root")),b()},9:function(e,t,n){}},[[12,1,2]]]);
//# sourceMappingURL=main.d9983bb6.chunk.js.map