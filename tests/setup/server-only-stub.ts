/**
 * Substituto de `server-only` sob teste.
 *
 * O pacote real existe para quebrar o build se um módulo de servidor for
 * importado pelo cliente. Num teste em Node não há cliente algum, e o pacote
 * lança ao ser carregado fora do bundler do Next — o que impediria testar
 * justamente as barreiras de segurança da camada de infraestrutura.
 */
export {};
