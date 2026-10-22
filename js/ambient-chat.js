// Conversas para dar vida ao chat quando não há encontro ativo.
const exchanges = [
  { topic: 'Música', lines: [
    '{a}: se a gente ensaiasse uma música agora, qual seria a primeira?',
    '{b}: uma bem animada. Daquelas que fazem até a pausa parecer parte do ritmo.'
  ]},
  { topic: 'Dia a dia', lines: [
    '{a}: hoje eu queria uma tarde sem pressa e uma janela aberta.',
    '{b}: apoio. E uma lista de músicas que começa calma e termina em karaokê.'
  ]},
  { topic: 'Comida', lines: [
    '{a}: pergunta séria: lanche doce ou salgado para acompanhar uma conversa?',
    '{b}: os dois. É uma decisão importante demais para escolher só um.'
  ]},
  { topic: 'Passeios', lines: [
    '{a}: qual passeio combina com um dia livre?',
    '{b}: caminhar sem mapa e parar quando aparecer um lugar interessante.'
  ]},
  { topic: 'Síntese vocal', lines: [
    '{a}: já conferiu se as transições da oto.ini estão suaves?',
    '{b}: sim! Ajustar preutterance e overlap pode ajudar a encaixar o início da nota.'
  ]},
  { topic: 'Curiosidades', lines: [
    '{a}: será que uma melodia fica diferente quando a gente muda só o andamento?',
    '{b}: muito. A mesma sequência pode soar contemplativa ou virar uma corrida divertida.'
  ]},
  { topic: 'Brincadeiras', lines: [
    '{a}: inventei um desafio: descrever uma música usando só três palavras.',
    '{b}: brilho, saudade e... pão de queijo. Acertei o clima?'
  ]},
  { topic: 'Criatividade', lines: [
    '{a}: estou guardando ideias para uma letra nova. Às vezes uma frase aleatória vira refrão.',
    '{b}: anota todas! Até as esquisitas podem encontrar a melodia certa.'
  ]},
  { topic: 'Tecnologia', lines: [
    '{a}: gosto de descobrir como cada ferramenta transforma uma ideia em música.',
    '{b}: e de testar com calma. Um ajuste por vez deixa mais fácil perceber o resultado.'
  ]},
  { topic: 'Sonhos', lines: [
    '{a}: qual lugar você gostaria de conhecer?',
    '{b}: uma biblioteca suspensa entre nuvens, com música baixinha em cada sala.'
  ]}
];

export function randomExchange(characters, previousTopic = '', random = Math.random) {
  if (characters.length < 2) return null;
  const available = exchanges.filter(exchange => exchange.topic !== previousTopic);
  const exchange = available[Math.floor(random() * available.length)];
  const first = Math.floor(random() * characters.length);
  let second = Math.floor(random() * (characters.length - 1));
  if (second >= first) second += 1;
  const a = characters[first], b = characters[second];
  return {
    topic: exchange.topic,
    messages: exchange.lines.map((line, index) => ({
      speaker: index === 0 ? a : b,
      text: line.replace('{a}', a.name).replace('{b}', b.name)
    }))
  };
}
