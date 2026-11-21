// Ekip paneli: kaynak Ingilizce, Ispanyolca ceviri
(function(){
KJI.add([
['Log out',null,'Salir'],['Crew login',null,'Acceso de equipo'],['Enter your email. We send you a login link.',null,'Escribe tu correo. Te enviamos un enlace de acceso.'],['Email',null,'Correo'],['Send login link',null,'Enviar enlace de acceso'],
['No crew account',null,'Sin cuenta de equipo'],['This email is not linked to a crew. Ask Kais.',null,'Este correo no está vinculado a un equipo. Pregunta a Kais.'],['No jobs assigned yet. Check back later.',null,'Aún no hay trabajos asignados. Vuelve más tarde.'],
['Time TBD',null,'Hora por definir'],['Customer',null,'Cliente'],['Access:',null,'Acceso:'],['Note:',null,'Nota:'],['🚚 On my way',null,'🚚 En camino'],['🛠 Working',null,'🛠 Trabajando'],['✅ Done',null,'✅ Listo'],['📷 Before',null,'📷 Antes'],['📷 After',null,'📷 Después'],['Photos:',null,'Fotos:'],
['· Done needs at least one After photo',null,'· "Listo" requiere al menos una foto de Después'],['Saved',null,'Guardado'],['Add an After photo first.',null,'Primero agrega una foto de Después.'],['Photos saved',null,'Fotos guardadas'],
['This month',null,'Este mes'],['Earned',null,'Ganado'],['Unpaid',null,'Por cobrar'],['Paid',null,'Pagado'],['Jobs done',null,'Trabajos hechos'],['My earnings',null,'Mis ganancias']
]);
KJI.pat(/^Uploading (\d+)…$/,null,'Subiendo $1…');
KJI.pat(/^Upload failed: (.*)$/,null,'Error al subir: $1');
KJI.init({src:'en',langs:['en','es']});
})();
