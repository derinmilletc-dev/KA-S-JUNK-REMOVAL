// Gunun sozu: ayin gunune gore 1 soz (30 soz, ayin 31'i basa doner). Sira: [Turkce, English, Espanol, Yazar]
(function(){
var Q=[
['Değer yarattığın oranda kazanırsın.','You will be paid in direct proportion to the value you create.','Se te pagará en proporción directa al valor que creas.','T. Harv Eker'],
['Bin millik yolculuk tek bir adımla başlar.','A journey of a thousand miles begins with a single step.','Un viaje de mil millas comienza con un solo paso.','Lao Tzu'],
['Büyük işler, küçük şeylerin bir araya gelmesiyle yapılır.','Great things are done by a series of small things brought together.','Las grandes cosas se hacen con una serie de pequeñas cosas juntas.','Vincent van Gogh'],
['Başarı, her gün tekrarlanan küçük çabaların toplamıdır.','Success is the sum of small efforts, repeated day in and day out.','El éxito es la suma de pequeños esfuerzos repetidos día tras día.','Robert Collier'],
['Şans, hazırlıklı olanın yanındadır.','Chance favors the prepared mind.','La suerte favorece a la mente preparada.','Louis Pasteur'],
['Cesaret, korkunun yokluğu değil, onu yenmektir.','Courage is not the absence of fear, but the triumph over it.','El coraje no es la ausencia de miedo, sino el triunfo sobre él.','Nelson Mandela'],
['Mükemmellik bir eylem değil, alışkanlıktır.','Excellence is not an act, but a habit.','La excelencia no es un acto, sino un hábito.','Will Durant'],
['Yapabilirim de dersin, yapamam da dersin; ikisinde de haklısın.','Whether you think you can, or you think you can’t, you’re right.','Si crees que puedes o crees que no puedes, tienes razón.','Henry Ford'],
['Mükemmel olmak için başlamalısın; başlamak için mükemmel olman gerekmez.','You don’t have to be great to start, but you have to start to be great.','No tienes que ser genial para empezar, pero tienes que empezar para ser genial.','Zig Ziglar'],
['Zor zamanlar geçer, güçlü insanlar kalır.','Tough times never last, but tough people do.','Los tiempos difíciles pasan, las personas fuertes permanecen.','Robert H. Schuller'],
['Hangi limana gittiğini bilmeyene hiçbir rüzgâr yardım etmez.','If a man does not know to which port he is sailing, no wind is favorable.','Si no sabes a qué puerto navegas, ningún viento es favorable.','Seneca'],
['Yapabileceğin en iyi yatırım, kendine yaptığındır.','The best investment you can make is in yourself.','La mejor inversión que puedes hacer es en ti mismo.','Warren Buffett'],
['Başarı tesadüf değildir; çalışma, azim ve fedakârlıktır.','Success is no accident. It is hard work, perseverance and sacrifice.','El éxito no es casualidad. Es trabajo duro, perseverancia y sacrificio.','Pelé'],
['Fırsatlar sabah güneşi gibidir; çok beklersen kaçırırsın.','Opportunities are like sunrises. If you wait too long, you miss them.','Las oportunidades son como los amaneceres: si esperas demasiado, te las pierdes.','William Arthur Ward'],
['Disiplin, hedeflerle başarı arasındaki köprüdür.','Discipline is the bridge between goals and accomplishment.','La disciplina es el puente entre las metas y los logros.','Jim Rohn'],
['Başarı, hazırlıkla fırsatın buluştuğu yerdir.','Success is where preparation and opportunity meet.','El éxito es donde la preparación y la oportunidad se encuentran.','Bobby Unser'],
['Yapılamaz diyen, yapanı rahatsız etmesin.','The one who says it cannot be done should not interrupt the one doing it.','Quien dice que no se puede no debería interrumpir a quien lo está haciendo.','Chinese proverb'],
['Ağaç dikmek için en iyi zaman yirmi yıl önceydi, ikincisi şimdi.','The best time to plant a tree was twenty years ago. The second best time is now.','El mejor momento para plantar un árbol fue hace veinte años. El segundo mejor es ahora.','Chinese proverb'],
['Damlaya damlaya göl olur.','Drop by drop, a lake is formed.','Gota a gota se forma un lago.','Turkish proverb'],
['Sabreden derviş muradına ermiş.','Patience is rewarded in the end.','La paciencia siempre tiene su recompensa.','Turkish proverb'],
['Bugünün işini yarına bırakma.','Never put off until tomorrow what you can do today.','No dejes para mañana lo que puedas hacer hoy.','Proverb'],
['İsteyen yol bulur, istemeyen bahane.','Where there is a will, there is a way.','Querer es poder.','Proverb'],
['Güven yıllarda kazanılır, bir anda kaybedilir.','Trust takes years to build and seconds to lose.','La confianza tarda años en construirse y segundos en perderse.','Business wisdom'],
['Memnun müşteri en iyi reklamdır.','A happy customer is the best advertisement.','Un cliente satisfecho es la mejor publicidad.','Business wisdom'],
['Her günü bitir ve bırak; yarın yeni bir başlangıçtır.','Finish each day and be done with it. Tomorrow is a new beginning.','Termina cada día y déjalo atrás. Mañana es un nuevo comienzo.','Ralph Waldo Emerson'],
['Düşmek yenilgi değildir, kalkmamak yenilgidir.','Falling is not failure. Staying down is.','Caer no es fracasar. Quedarse en el suelo, sí.','Proverb'],
['Durmadığın sürece, ne kadar yavaş gittiğin önemli değil.','It does not matter how slowly you go, as long as you do not stop.','No importa lo despacio que vayas, mientras no te detengas.','Confucius'],
['Hayatta en hakiki mürşit ilimdir.','In life, the truest guide is knowledge.','En la vida, el guía más verdadero es el conocimiento.','Atatürk'],
['Dün dünde kaldı, bugün yeni şeyler söylemek lazım.','Yesterday is gone. Today we must say new things.','Ayer quedó atrás. Hoy hay que decir cosas nuevas.','Rumi'],
['Dehâ yüzde bir ilham, yüzde doksan dokuz terdir.','Genius is one percent inspiration and ninety-nine percent perspiration.','El genio es un uno por ciento de inspiración y un noventa y nueve por ciento de transpiración.','Thomas Edison']];
var A={'Chinese proverb':['Çin atasözü','Proverbio chino'],'Turkish proverb':['Atasözü','Proverbio turco'],'Proverb':['Atasözü','Proverbio'],'Business wisdom':['İş dünyası sözü','Sabiduría empresarial']};
window.KJQuote={all:Q,today:function(lang,d){d=d||new Date();var i=(d.getDate()-1)%Q.length,q=Q[i],k=lang==='es'?2:lang==='tr'?0:1,by=q[3];if(A[by]&&k!==1)by=A[by][k===0?0:1];return{text:q[k],by:by,n:i+1}}};
})();
