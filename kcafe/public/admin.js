const API="http://localhost:3000";
let chart=null;
const ICONS={"WiFi":"📡","Piscina":"🏊","Spa":"🧖","Senderismo":"🥾","Yoga":"🧘","Fogón":"🔥","default":"✦"};
const TIERS=["tb","tp","tv"];
const CLABELS={activo:"Activo",inactivo:"Inactivo",disponible:"Disponible",ocupada:"Ocupada",mantenimiento:"Mantenimiento",agotado:"Agotado",no_disponible:"No disponible"};
const CCLASS={activo:"ca",disponible:"ca",inactivo:"co",ocupada:"co",agotado:"cag",no_disponible:"cn",mantenimiento:"cm"};

function navTo(id,el){document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));document.getElementById('sec-'+id).classList.add('active');el.classList.add('active');if(id==='clientes'){cargCli();poblarSel();}if(id==='cabanas')cargCab();if(id==='servicios')cargSvc();if(id==='paquetes')cargPkg();}
function toast(msg,t='success'){const el=document.getElementById('toast');el.textContent=msg;el.className=t+' show';clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3000);}
function cerrarM(id){document.getElementById(id).classList.remove('open');}
document.addEventListener('click',e=>{if(e.target.classList.contains('mo'))e.target.classList.remove('open');});
function limpiar(...ids){ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});}
function chip(e){return`<span class="chip ${CCLASS[e]||'cn'}">${CLABELS[e]||e}</span>`;}
function verImg(url){document.getElementById('img-src').src=url;document.getElementById('img-m').classList.add('open');}
function animN(id,v){const el=document.getElementById(id);const s=performance.now();const r=n=>{const t=Math.min((n-s)/700,1);el.textContent=Math.round((1-Math.pow(1-t,3))*v);if(t<1)requestAnimationFrame(r);else el.textContent=v;};requestAnimationFrame(r);}

function iniciar(){
  document.getElementById('fecha-chip').textContent=new Date().toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  cargDash();poblarSel();
}

function cargDash(){
  Promise.all([fetch(`${API}/total-clientes`).then(r=>r.json()),fetch(`${API}/total-cabanas`).then(r=>r.json()),fetch(`${API}/total-servicios`).then(r=>r.json()),fetch(`${API}/total-paquetes`).then(r=>r.json()),fetch(`${API}/servicios`).then(r=>r.json()),fetch(`${API}/cabanas`).then(r=>r.json())])
  .then(([tc,tcab,ts,tp,svcs,cabs])=>{
    animN('m-cli',tc.total);animN('m-cab',tcab.total);animN('m-svc',ts.total);animN('m-pkg',tp.total);
    document.getElementById('bd-svc').textContent=svcs.length;
    const sl=document.getElementById('d-svc');
    sl.innerHTML=svcs.map(s=>{const ico=ICONS[s.nombre]||ICONS['default'];return`<div class="sr"><span>${ico} ${s.nombre}</span>${chip(s.estado)}</div>`;}).join('');
    const dc=document.getElementById('d-cab');
    const disp=cabs.filter(c=>c.Estado==='disponible');
    if(!disp.length){dc.innerHTML='<div style="color:var(--faint);font-size:12px;padding:1rem">Sin cabañas disponibles</div>';return;}
    dc.innerHTML=disp.map(c=>{const pr=Number(c.precio_noche).toLocaleString('es-CO');const img=c.imagen_url?`<img class="ci" src="${c.imagen_url}" alt="${c.nombre}" onclick="verImg('${c.imagen_url}')" onerror="this.style.display='none'">`:`<div class="cip">🏕️</div>`;return`<div class="cc"><div class="ciw">${img}<span class="ced ca">Disponible</span></div><div class="cb"><div class="cn2">${c.nombre}</div><div class="cf"><span class="cpr">$${pr}/noche</span><span class="ccap">👥${c.capacidad}</span></div></div></div>`;}).join('');
    const ctx=document.getElementById('grafica').getContext('2d');
    if(chart)chart.destroy();
    chart=new Chart(ctx,{type:'bar',data:{labels:['Clientes','Cabañas','Servicios','Paquetes'],datasets:[{data:[tc.total,tcab.total,ts.total,tp.total],backgroundColor:['rgba(122,158,126,.7)','rgba(107,90,62,.7)','rgba(196,154,60,.7)','rgba(184,92,56,.7)'],borderColor:['#7a9e7e','#6b5a3e','#c49a3c','#b85c38'],borderWidth:1.5,borderRadius:3,borderSkipped:false,barThickness:40}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',borderColor:'#e0d8cc',borderWidth:1,titleColor:'#2a1f14',bodyColor:'#7a6e62',titleFont:{family:'Inter',size:11},bodyFont:{family:'Inter',size:11},callbacks:{label:c=>`  ${c.parsed.y} registros`}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#b0a898',font:{family:'Inter',size:10}}},y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.06)'},border:{display:false},ticks:{color:'#b0a898',precision:0,stepSize:1,font:{family:'Inter',size:10}}}}}});
  }).catch(()=>toast('Error de conexión','error'));
}

function poblarSel(){
  Promise.all([fetch(`${API}/paquetes`).then(r=>r.json()),fetch(`${API}/cabanas`).then(r=>r.json())])
  .then(([pkgs,cabs])=>{
    ['cpkg','e-cpkg'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=el.value;el.innerHTML='<option value="">— Sin paquete —</option>'+pkgs.map(p=>`<option value="${p.id}">${p.nombre} ($${Number(p.precio).toLocaleString('es-CO')})</option>`).join('');if(v)el.value=v;});
    ['ccab','e-ccab'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=el.value;el.innerHTML='<option value="">— Sin cabaña —</option>'+cabs.map(c=>`<option value="${c.id}">${c.nombre} (${CLABELS[c.Estado]||c.Estado})</option>`).join('');if(v)el.value=v;});
  });
}

/* CLIENTES */
function cargCli(){
  fetch(`${API}/clientes`).then(r=>r.json()).then(data=>{
    document.getElementById('b-cli').textContent=`${data.length} clientes`;
    const tb=document.getElementById('t-cli');
    if(!data.length){tb.innerHTML='<tr><td colspan="10" class="es">Sin clientes registrados</td></tr>';return;}
    tb.innerHTML=data.map(c=>`<tr><td class="tid">#${String(c.id).padStart(3,'0')}</td><td><strong style="font-weight:500">${c.nombre}</strong></td><td style="color:var(--muted)">${c.documento}</td><td style="color:var(--muted)">${c.telefono||'—'}</td><td style="color:var(--muted)">${c.procedencia||'—'}</td><td style="color:var(--gold);font-weight:500">${c.dias} día${c.dias>1?'s':''}</td><td>${c.cabana_nombre||'—'}</td><td>${c.paquete_nombre?`<span class="${TIERS[0]}">${c.paquete_nombre}</span>`:'—'}</td><td>${chip(c.estado)}</td><td><div class="tac"><button class="btn be bsm" onclick='abrirCli(${JSON.stringify(c)})'>Editar</button><button class="btn bd bsm" onclick="elimCli(${c.id},'${c.nombre}')">Eliminar</button></div></td></tr>`).join('');
  }).catch(()=>toast('Error al cargar','error'));
}
function agregarCliente(){
  const n=document.getElementById('cn').value.trim(),d=document.getElementById('cd').value.trim(),dias=document.getElementById('cdias').value.trim();
  if(!n||n.length<3){toast('Nombre obligatorio (mín. 3 caracteres)','error');return;}
  if(!d||!/^[0-9]+$/.test(d)){toast('Documento inválido — solo números','error');return;}
  if(!dias||isNaN(dias)||Number(dias)<1){toast('Mínimo 1 día de estadía','error');return;}
  fetch(`${API}/clientes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,documento:d,telefono:document.getElementById('ct').value.trim()||null,procedencia:document.getElementById('cp').value.trim()||null,email:document.getElementById('ce').value.trim()||null,dias:Number(dias),id_cabana:document.getElementById('ccab').value||null,id_paquete:document.getElementById('cpkg').value||null})})
  .then(r=>r.json()).then(d=>{if(d.error)throw new Error(d.error);toast(`"${n}" registrado`);limpiar('cn','cd','ct','cp','cdias','ce');document.getElementById('ccab').value='';document.getElementById('cpkg').value='';cargCli();cargDash();}).catch(e=>toast(e.message,'error'));
}
function abrirCli(c){document.getElementById('e-cli-id').value=c.id;document.getElementById('e-cn').value=c.nombre;document.getElementById('e-cd').value=c.documento;document.getElementById('e-ct').value=c.telefono||'';document.getElementById('e-cp').value=c.procedencia||'';document.getElementById('e-ce').value=c.email||'';document.getElementById('e-cdias').value=c.dias;document.getElementById('e-cest').value=c.estado;poblarSel();setTimeout(()=>{document.getElementById('e-ccab').value=c.id_cabana||'';document.getElementById('e-cpkg').value=c.id_paquete||'';},200);document.getElementById('m-cli').classList.add('open');}
function guardarCliente(){const id=document.getElementById('e-cli-id').value,n=document.getElementById('e-cn').value.trim(),d=document.getElementById('e-cd').value.trim(),dias=document.getElementById('e-cdias').value;if(!n||n.length<3){toast('Nombre inválido','error');return;}if(!d||!/^[0-9]+$/.test(d)){toast('Documento inválido','error');return;}if(!dias||Number(dias)<1){toast('Mínimo 1 día','error');return;}fetch(`${API}/clientes/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,documento:d,telefono:document.getElementById('e-ct').value.trim()||null,procedencia:document.getElementById('e-cp').value.trim()||null,email:document.getElementById('e-ce').value.trim()||null,dias:Number(dias),id_cabana:document.getElementById('e-ccab').value||null,id_paquete:document.getElementById('e-cpkg').value||null,estado:document.getElementById('e-cest').value})}).then(r=>r.json()).then(()=>{toast('Actualizado');cerrarM('m-cli');cargCli();cargDash();}).catch(()=>toast('Error','error'));}
function elimCli(id,n){if(!confirm(`¿Eliminar a "${n}"?`))return;fetch(`${API}/clientes/${id}`,{method:'DELETE'}).then(()=>{toast(`"${n}" eliminado`);cargCli();cargDash();}).catch(()=>toast('Error','error'));}

/* CABAÑAS */
function cargCab(){
  fetch(`${API}/cabanas`).then(r=>r.json()).then(data=>{
    const el=document.getElementById('cabanas-cards');
    if(!data.length){el.innerHTML='<div style="color:var(--faint);padding:2rem;font-size:12px">Sin cabañas</div>';return;}
    el.innerHTML=data.map(c=>{const pr=Number(c.precio_noche).toLocaleString('es-CO');const img=c.imagen_url?`<img class="ci" src="${c.imagen_url}" alt="${c.nombre}" onclick="verImg('${c.imagen_url}')" onerror="this.style.display='none'">`:`<div class="cip">🏕️</div>`;return`<div class="cc"><div class="ciw">${img}<span class="ced ${CCLASS[c.Estado]||'cn'}">${CLABELS[c.Estado]||c.Estado}</span></div><div class="cb"><div class="cn2">${c.nombre}</div><div class="cd2">${c.descripcion||''}</div><div class="cf"><span class="cpr">$${pr}/noche</span><span class="ccap">👥 ${c.capacidad} pers.</span></div><div class="cac"><button class="btn be bsm" onclick='abrirCab(${JSON.stringify(c)})'>Editar</button><button class="btn bd bsm" onclick="elimCab(${c.id},'${c.nombre}')">Eliminar</button></div></div></div>`;}).join('');
  }).catch(()=>toast('Error','error'));
}
function agregarCabana(){const n=document.getElementById('cabn').value.trim(),pr=document.getElementById('cabpr').value.trim();if(!n){toast('Nombre obligatorio','error');return;}if(!pr||isNaN(pr)||Number(pr)<0){toast('Precio inválido','error');return;}fetch(`${API}/cabanas`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,capacidad:document.getElementById('cabcap').value||2,precio_noche:Number(pr),descripcion:document.getElementById('cabdesc').value.trim()||null,imagen_url:document.getElementById('cabimg').value.trim()||null,Estado:document.getElementById('cabest').value})}).then(r=>r.json()).then(d=>{if(d.error)throw new Error(d.error);toast(`"${n}" creada`);limpiar('cabn','cabdesc','cabimg','cabpr');document.getElementById('cabcap').value=2;cargCab();cargDash();poblarSel();}).catch(e=>toast(e.message,'error'));}
function abrirCab(c){document.getElementById('e-cab-id').value=c.id;document.getElementById('e-cabn').value=c.nombre;document.getElementById('e-cabcap').value=c.capacidad;document.getElementById('e-cabpr').value=c.precio_noche;document.getElementById('e-cabdesc').value=c.descripcion||'';document.getElementById('e-cabimg').value=c.imagen_url||'';document.getElementById('e-cabest').value=c.Estado;document.getElementById('m-cab').classList.add('open');}
function guardarCabana(){const id=document.getElementById('e-cab-id').value;fetch(`${API}/cabanas/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:document.getElementById('e-cabn').value.trim(),capacidad:document.getElementById('e-cabcap').value,precio_noche:document.getElementById('e-cabpr').value,descripcion:document.getElementById('e-cabdesc').value.trim()||null,imagen_url:document.getElementById('e-cabimg').value.trim()||null,Estado:document.getElementById('e-cabest').value})}).then(()=>{toast('Actualizada');cerrarM('m-cab');cargCab();cargDash();poblarSel();}).catch(()=>toast('Error','error'));}
function elimCab(id,n){if(!confirm(`¿Eliminar "${n}"?`))return;fetch(`${API}/cabanas/${id}`,{method:'DELETE'}).then(()=>{toast(`"${n}" eliminada`);cargCab();cargDash();}).catch(()=>toast('Error','error'));}

/* SERVICIOS */
function cargSvc(){
  fetch(`${API}/servicios`).then(r=>r.json()).then(data=>{
    document.getElementById('b-svc').textContent=`${data.length} servicios`;
    const tb=document.getElementById('t-svc');
    if(!data.length){tb.innerHTML='<tr><td colspan="5" class="es">Sin servicios</td></tr>';return;}
    tb.innerHTML=data.map(s=>{const ico=ICONS[s.nombre]||ICONS['default'];return`<tr><td class="tid">#${String(s.id).padStart(3,'0')}</td><td>${ico} <strong style="font-weight:500">${s.nombre}</strong></td><td style="color:var(--muted);font-size:11px">${s.descripcion||'—'}</td><td><span class="chip ${CCLASS[s.estado]||'cn'}" onclick="ciclarSvc(${s.id},'${s.estado}',this)" title="Clic para cambiar estado">${CLABELS[s.estado]||s.estado}</span></td><td><div class="tac"><button class="btn be bsm" onclick="abrirSvc(${s.id},'${s.nombre}','${(s.descripcion||'').replace(/'/g,'&apos;')}','${s.estado}')">Editar</button><button class="btn bd bsm" onclick="elimSvc(${s.id},'${s.nombre}')">Eliminar</button></div></td></tr>`;}).join('');
  }).catch(()=>toast('Error','error'));
}
function ciclarSvc(id,est,el){const c=['activo','agotado','no_disponible'];const n=c[(c.indexOf(est)+1)%3];fetch(`${API}/servicios/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado:n})}).then(()=>{el.className=`chip ${CCLASS[n]}`;el.textContent=CLABELS[n];el.setAttribute('onclick',`ciclarSvc(${id},'${n}',this)`);toast(`→ ${CLABELS[n]}`);cargDash();}).catch(()=>toast('Error','error'));}
function agregarServicio(){const n=document.getElementById('svn').value.trim();if(!n){toast('Nombre obligatorio','error');return;}fetch(`${API}/servicios`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,descripcion:document.getElementById('svdesc').value.trim()||null,estado:document.getElementById('svest').value})}).then(r=>r.json()).then(d=>{if(d.error)throw new Error(d.error);toast(`"${n}" agregado`);limpiar('svn','svdesc');cargSvc();cargDash();}).catch(e=>toast(e.message,'error'));}
function abrirSvc(id,n,desc,est){document.getElementById('e-svc-id').value=id;document.getElementById('e-svn').value=n;document.getElementById('e-svdesc').value=desc;document.getElementById('e-svest').value=est;document.getElementById('m-svc').classList.add('open');}
function guardarServicio(){const id=document.getElementById('e-svc-id').value;fetch(`${API}/servicios/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:document.getElementById('e-svn').value.trim(),descripcion:document.getElementById('e-svdesc').value.trim()||null,estado:document.getElementById('e-svest').value})}).then(()=>{toast('Actualizado');cerrarM('m-svc');cargSvc();cargDash();}).catch(()=>toast('Error','error'));}
function elimSvc(id,n){if(!confirm(`¿Eliminar "${n}"?`))return;fetch(`${API}/servicios/${id}`,{method:'DELETE'}).then(()=>{toast(`"${n}" eliminado`);cargSvc();cargDash();}).catch(()=>toast('Error','error'));}

/* PAQUETES */
function cargPkg(){
  fetch(`${API}/paquetes`).then(r=>r.json()).then(data=>{
    document.getElementById('b-pkg').textContent=`${data.length} paquetes`;
    const tb=document.getElementById('t-pkg');
    if(!data.length){tb.innerHTML='<tr><td colspan="6" class="es">Sin paquetes</td></tr>';return;}
    tb.innerHTML=data.map((p,i)=>{const pr=Number(p.precio).toLocaleString('es-CO');return`<tr><td class="tid">#${String(p.id).padStart(3,'0')}</td><td><span class="${TIERS[i]||TIERS[0]}">${p.nombre}</span></td><td style="color:var(--gold);font-family:'Playfair Display',serif;font-size:14px">$${pr}</td><td style="color:var(--muted);font-size:11px">${p.descripcion||'—'}</td><td><span class="chip ${CCLASS[p.estado]||'cn'}" onclick="ciclarPkg(${p.id},'${p.estado}',this)" title="Clic para cambiar">${CLABELS[p.estado]||p.estado}</span></td><td><div class="tac"><button class="btn be bsm" onclick='abrirPkg(${JSON.stringify(p)})'>Editar</button><button class="btn bd bsm" onclick="elimPkg(${p.id},'${p.nombre}')">Eliminar</button></div></td></tr>`;}).join('');
  }).catch(()=>toast('Error','error'));
}
function ciclarPkg(id,est,el){const c=['activo','agotado','no_disponible'];const n=c[(c.indexOf(est)+1)%3];fetch(`${API}/paquetes/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado:n})}).then(()=>{el.className=`chip ${CCLASS[n]}`;el.textContent=CLABELS[n];el.setAttribute('onclick',`ciclarPkg(${id},'${n}',this)`);toast(`→ ${CLABELS[n]}`);cargDash();}).catch(()=>toast('Error','error'));}
function agregarPaquete(){const n=document.getElementById('pkn').value.trim(),pr=document.getElementById('pkp').value.trim();if(!n){toast('Nombre obligatorio','error');return;}if(!pr||isNaN(pr)||Number(pr)<0){toast('Precio inválido','error');return;}fetch(`${API}/paquetes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,precio:Number(pr),descripcion:document.getElementById('pkd').value.trim()||null,estado:document.getElementById('pke').value})}).then(r=>r.json()).then(d=>{if(d.error)throw new Error(d.error);toast(`"${n}" agregado`);limpiar('pkn','pkp','pkd');cargPkg();cargDash();poblarSel();}).catch(e=>toast(e.message,'error'));}
function abrirPkg(p){document.getElementById('e-pkg-id').value=p.id;document.getElementById('e-pkn').value=p.nombre;document.getElementById('e-pkp').value=p.precio;document.getElementById('e-pkd').value=p.descripcion||'';document.getElementById('e-pke').value=p.estado;document.getElementById('m-pkg').classList.add('open');}
function guardarPaquete(){const id=document.getElementById('e-pkg-id').value,n=document.getElementById('e-pkn').value.trim(),pr=document.getElementById('e-pkp').value;if(!n||!pr){toast('Nombre y precio obligatorios','error');return;}fetch(`${API}/paquetes/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,precio:Number(pr),descripcion:document.getElementById('e-pkd').value.trim()||null,estado:document.getElementById('e-pke').value})}).then(()=>{toast('Actualizado');cerrarM('m-pkg');cargPkg();cargDash();poblarSel();}).catch(()=>toast('Error','error'));}
function elimPkg(id,n){if(!confirm(`¿Eliminar "${n}"?`))return;fetch(`${API}/paquetes/${id}`,{method:'DELETE'}).then(()=>{toast(`"${n}" eliminado`);cargPkg();cargDash();}).catch(()=>toast('Error','error'));}

iniciar();
