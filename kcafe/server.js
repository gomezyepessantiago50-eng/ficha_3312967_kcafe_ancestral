const express = require("express");
const mysql   = require("mysql2");
const cors    = require("cors");
const path    = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createConnection({ host:"localhost", user:"root", password:"", database:"kcafe_db" });
db.connect(err => { if(err) console.error("❌",err.message); else console.log("✅ MySQL — kcafe_db"); });

app.get("/",      (req,res) => res.sendFile(path.join(__dirname,"public","vista.html")));
app.get("/admin", (req,res) => res.sendFile(path.join(__dirname,"public","admin.html")));

const q = (sql, p=[]) => new Promise((ok,fail) => db.query(sql,p,(e,r)=>e?fail(e):ok(r)));

app.get("/cabanas",  async(req,res)=>{ try{ res.json(await q("SELECT * FROM cabanas ORDER BY id")); }catch(e){ res.status(500).json({error:e.message}); }});
app.post("/cabanas", async(req,res)=>{ const{nombre,capacidad,precio_noche,descripcion,imagen_url,Estado}=req.body; if(!nombre||nombre.length<2) return res.status(400).json({error:"Nombre inválido"}); if(!precio_noche||isNaN(precio_noche)||Number(precio_noche)<0) return res.status(400).json({error:"Precio inválido"}); try{ const r=await q("INSERT INTO cabanas (nombre,capacidad,precio_noche,descripcion,imagen_url,Estado) VALUES (?,?,?,?,?,?)",[nombre,capacidad||2,Number(precio_noche),descripcion||null,imagen_url||null,Estado||"disponible"]); res.json({mensaje:"Cabaña creada",id:r.insertId}); }catch(e){ res.status(500).json({error:e.message}); }});
app.put("/cabanas/:id", async(req,res)=>{ const{nombre,capacidad,precio_noche,descripcion,imagen_url,Estado}=req.body; try{ await q("UPDATE cabanas SET nombre=?,capacidad=?,precio_noche=?,descripcion=?,imagen_url=?,Estado=? WHERE id=?",[nombre,capacidad,precio_noche,descripcion||null,imagen_url||null,Estado,req.params.id]); res.json({mensaje:"OK"}); }catch(e){ res.status(500).json({error:e.message}); }});
app.delete("/cabanas/:id", async(req,res)=>{ try{ await q("DELETE FROM cabanas WHERE id=?",[req.params.id]); res.json({mensaje:"OK"}); }catch(e){ res.status(500).json({error:e.message}); }});

app.get("/clientes", async(req,res)=>{ try{ res.json(await q("SELECT c.*,cb.nombre AS cabana_nombre,p.nombre AS paquete_nombre FROM clientes c LEFT JOIN cabanas cb ON c.id_cabana=cb.id LEFT JOIN paquetes p ON c.id_paquete=p.id ORDER BY c.id DESC")); }catch(e){ res.status(500).json({error:e.message}); }});
app.post("/clientes", async(req,res)=>{ const{nombre,documento,telefono,procedencia,email,dias,id_cabana,id_paquete}=req.body; if(!nombre||nombre.trim().length<3) return res.status(400).json({error:"Nombre obligatorio (mínimo 3 caracteres)"}); if(!documento||!/^[0-9]+$/.test(documento)) return res.status(400).json({error:"Documento inválido — solo números"}); if(!dias||isNaN(dias)||Number(dias)<1) return res.status(400).json({error:"Mínimo 1 día de estadía"}); try{ const r=await q("INSERT INTO clientes (nombre,documento,telefono,procedencia,email,dias,id_cabana,id_paquete) VALUES (?,?,?,?,?,?,?,?)",[nombre.trim(),documento,telefono||null,procedencia||null,email||null,Number(dias),id_cabana||null,id_paquete||null]); res.json({mensaje:"Registrado",id:r.insertId}); }catch(e){ res.status(500).json({error:e.message}); }});
app.put("/clientes/:id", async(req,res)=>{ const{nombre,documento,telefono,procedencia,email,dias,id_cabana,id_paquete,estado}=req.body; if(!nombre||nombre.trim().length<3) return res.status(400).json({error:"Nombre inválido"}); if(!documento||!/^[0-9]+$/.test(documento)) return res.status(400).json({error:"Documento inválido"}); try{ await q("UPDATE clientes SET nombre=?,documento=?,telefono=?,procedencia=?,email=?,dias=?,id_cabana=?,id_paquete=?,estado=? WHERE id=?",[nombre.trim(),documento,telefono||null,procedencia||null,email||null,dias,id_cabana||null,id_paquete||null,estado||"activo",req.params.id]); res.json({mensaje:"OK"}); }catch(e){ res.status(500).json({error:e.message}); }});
app.delete("/clientes/:id", async(req,res)=>{ try{ await q("DELETE FROM clientes WHERE id=?",[req.params.id]); res.json({mensaje:"OK"}); }catch(e){ res.status(500).json({error:e.message}); }});

app.get("/servicios", async(req,res)=>{ try{ res.json(await q("SELECT * FROM servicios ORDER BY id")); }catch(e){ res.status(500).json({error:e.message}); }});
app.post("/servicios", async(req,res)=>{ const{nombre,descripcion,estado}=req.body; if(!nombre||nombre.length<2) return res.status(400).json({error:"Nombre inválido"}); try{ const r=await q("INSERT INTO servicios (nombre,descripcion,estado) VALUES (?,?,?)",[nombre,descripcion||null,["activo","agotado","no_disponible"].includes(estado)?estado:"activo"]); res.json({mensaje:"OK",id:r.insertId}); }catch(e){ res.status(500).json({error:e.message}); }});
app.put("/servicios/:id", async(req,res)=>{ const{nombre,descripcion,estado}=req.body; try{ await q("UPDATE servicios SET nombre=?,descripcion=?,estado=? WHERE id=?",[nombre,descripcion||null,estado,req.params.id]); res.json({mensaje:"OK"}); }catch(e){ res.status(500).json({error:e.message}); }});
app.delete("/servicios/:id", async(req,res)=>{ try{ await q("DELETE FROM servicios WHERE id=?",[req.params.id]); res.json({mensaje:"OK"}); }catch(e){ res.status(500).json({error:e.message}); }});

app.get("/paquetes", async(req,res)=>{ try{ res.json(await q("SELECT * FROM paquetes ORDER BY precio ASC")); }catch(e){ res.status(500).json({error:e.message}); }});
app.post("/paquetes", async(req,res)=>{ const{nombre,precio,descripcion,estado}=req.body; if(!nombre||nombre.length<2) return res.status(400).json({error:"Nombre inválido"}); if(precio===undefined||isNaN(precio)||Number(precio)<0) return res.status(400).json({error:"Precio inválido"}); try{ const r=await q("INSERT INTO paquetes (nombre,precio,descripcion,estado) VALUES (?,?,?,?)",[nombre,Number(precio),descripcion||null,["activo","agotado","no_disponible"].includes(estado)?estado:"activo"]); res.json({mensaje:"OK",id:r.insertId}); }catch(e){ res.status(500).json({error:e.message}); }});
app.put("/paquetes/:id", async(req,res)=>{ const{nombre,precio,descripcion,estado}=req.body; try{ await q("UPDATE paquetes SET nombre=?,precio=?,descripcion=?,estado=? WHERE id=?",[nombre,precio,descripcion||null,estado,req.params.id]); res.json({mensaje:"OK"}); }catch(e){ res.status(500).json({error:e.message}); }});
app.delete("/paquetes/:id", async(req,res)=>{ try{ await q("DELETE FROM paquetes WHERE id=?",[req.params.id]); res.json({mensaje:"OK"}); }catch(e){ res.status(500).json({error:e.message}); }});

app.get("/total-clientes",  async(req,res)=>{ try{ const r=await q("SELECT COUNT(*) as t FROM clientes");  res.json({total:r[0].t}); }catch(e){ res.json({total:0}); }});
app.get("/total-cabanas",   async(req,res)=>{ try{ const r=await q("SELECT COUNT(*) as t FROM cabanas");   res.json({total:r[0].t}); }catch(e){ res.json({total:0}); }});
app.get("/total-servicios", async(req,res)=>{ try{ const r=await q("SELECT COUNT(*) as t FROM servicios"); res.json({total:r[0].t}); }catch(e){ res.json({total:0}); }});
app.get("/total-paquetes",  async(req,res)=>{ try{ const r=await q("SELECT COUNT(*) as t FROM paquetes");  res.json({total:r[0].t}); }catch(e){ res.json({total:0}); }});

app.listen(3000, ()=>console.log("\n☕ Kcafé Ancestral\n   Vista cliente → http://localhost:3000\n   Admin         → http://localhost:3000/admin\n"));
