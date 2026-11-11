// Formulário → código PHP com curl para POST https://baldio.eu/api/v1/adicionar (não envia nada daqui)
(() => {
  'use strict';

  // tipos aceites pela API (project_type / event_type do Baldio)
  const TYPES = {
    projeto: {
      'alimentacao-economia-local': 'Alimentação / Economia local',
      'associacao-acao-territorial': 'Associação / Ação territorial',
      'bem-estar-terapias': 'Bem-estar / Terapias',
      'bioconstrucao-habitacao': 'Bioconstrução / Habitação',
      'comunicacao-tecnologia': 'Comunicação / Tecnologia',
      'comunidade-ecoaldeia': 'Comunidade / Ecoaldeia',
      'cultura-eventos': 'Cultura / Eventos',
      'educacao-aprendizagem': 'Educação / Aprendizagem',
      'floresta-regeneracao': 'Floresta / Regeneração',
      'investigacao-consultoria': 'Investigação / Consultoria',
      'quinta-agroecologia': 'Quinta / Agroecologia',
      'turismo-experiencias': 'Turismo / Experiências',
    },
    evento: {
      curso: 'Curso',
      encontro: 'Encontro',
      feira: 'Feira',
      festival: 'Festival',
      imersao: 'Imersão',
      palestra: 'Palestra',
      'projecao-filme': 'Projecção de filme',
      retiro: 'Retiro',
      workshop: 'Workshop',
    },
  };

  const form = document.getElementById('form');
  const code = document.getElementById('code');
  const problems = document.getElementById('problems');
  const typeSelect = document.getElementById('type');

  const area = () => form.elements.area.value;
  const value = name => form.elements[name].value.trim();

  function fillTypes() {
    typeSelect.innerHTML = '';
    Object.entries(TYPES[area()]).forEach(([slug, name]) => typeSelect.add(new Option(name, slug)));
    form.querySelectorAll('.event-only').forEach(el => { el.hidden = area() !== 'evento'; });
  }

  // os campos que vão no pedido, só os preenchidos
  function fields() {
    const isEvent = area() === 'evento';
    const out = {
      area: area(),
      type: value('type'),
      nome: value('nome'),
      descricao: value('descricao'),
      email: value('email') || 'nome@exemplo.pt',
      onde: value('onde'),
      website: value('website'),
    };
    if (isEvent) {
      out.start_date = value('start_date');
      out.start_time = value('start_time');
      if (value('signup_url')) Object.assign(out, { signup_mode: 'link', signup_url: value('signup_url') });
    }
    if (form.elements.draft.checked) out.draft = '1';
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== ''));
  }

  // as mesmas regras que a API aplica, para avisar antes de correr o código
  function validate(data) {
    const list = [];
    if (data.nome.length < 2) list.push('O nome precisa de pelo menos 2 caracteres.');
    if (data.descricao.length < 5) list.push('A descrição precisa de pelo menos 5 caracteres.');
    if (!value('email')) list.push('Falta o email do responsável (o código usa um de exemplo).');
    return list;
  }

  const phpString = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

  function render() {
    const data = fields();
    const width = Math.max(...Object.keys(data).map(k => k.length)) + 2;
    const lines = Object.entries(data)
      .map(([k, v]) => `    ${phpString(k).padEnd(width)} => ${phpString(v)},`)
      .join('\n');

    code.textContent = `<?php
// Adiciona ${data.area === 'evento' ? 'um evento' : 'um projecto'} ao Baldio (https://baldio.eu/api)
$campos = [
${lines}
];

$curl = curl_init('https://baldio.eu/api/v1/adicionar');
curl_setopt_array($curl, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query($campos),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
]);
$resposta = curl_exec($curl);
$estado   = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

$json = json_decode((string) $resposta, true);
if ($estado === 200) {
    echo "Criado: {$json['entity_type']} {$json['entity_id']}\\n";
    echo "Gerir: https://baldio.eu{$json['redirect']}\\n";
} else {
    echo "Erro {$estado}: " . ($json['error'] ?? $resposta) . "\\n";
}
`;
    problems.innerHTML = validate(data).map(p => `<div>• ${p}</div>`).join('');
  }

  form.addEventListener('input', render);
  form.addEventListener('change', e => {
    if (e.target.name === 'area') fillTypes();
    render();
  });

  fillTypes();
  render();
})();
