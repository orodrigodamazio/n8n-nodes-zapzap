const path = require('path');
const { task, src, dest } = require('gulp');

// Copia os ícones SVG/PNG dos nodes e credentials para dist/ mantendo a estrutura.
// Padrão oficial do n8n-nodes-starter.
task('build:icons', copyIcons);
task('build:codex', copyCodex);

// Copia os arquivos de tradução (translations/<locale>/*.json) para dist/ mantendo a
// estrutura esperada pelo n8n: dist/nodes/<Node>/translations/<locale>/<node>.json.
task('build:translations', copyTranslations);

function copyIcons() {
	const nodeSource = path.resolve('nodes', '**', '*.{png,svg}');
	const nodeDestination = path.resolve('dist', 'nodes');

	src(nodeSource, { encoding: false }).pipe(dest(nodeDestination));

	const credSource = path.resolve('credentials', '**', '*.{png,svg}');
	const credDestination = path.resolve('dist', 'credentials');

	return src(credSource, { encoding: false }).pipe(dest(credDestination));
}

function copyTranslations() {
	const source = path.resolve('nodes', '**', 'translations', '**', '*.json');
	const destination = path.resolve('dist', 'nodes');

	return src(source, { base: path.resolve('nodes') }).pipe(dest(destination));
}

// Codex metadata (categories, aliases and docs links used by the n8n search).
function copyCodex() {
	return src(path.resolve('nodes', '**', '*.node.json'), { base: path.resolve('nodes') }).pipe(
		dest(path.resolve('dist', 'nodes')),
	);
}
