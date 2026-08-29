# ADR 0001 — O household é o limite multi-tenant

**Data:** 2026-08-28
**Estado:** aceito

## Contexto

A aplicação é usada por pessoas sozinhas, por casais e por famílias. Os dados
financeiros precisam ser compartilháveis entre algumas pessoas e absolutamente
inacessíveis para todas as outras.

Duas alternativas foram consideradas: dados pertencerem ao usuário, com
compartilhamento por permissão; ou dados pertencerem a um grupo, com usuários
associados a ele.

## Decisão

Todo dado financeiro pertence a um `Household`. O acesso é concedido
exclusivamente por um documento de membership em
`households/{householdId}/members/{uid}` com `status: ACTIVE`.

Um usuário pode pertencer a vários households. `visibility` e
`responsibleMemberId` separam o que é pessoal do que é da casa **dentro** de um
household — são atributos de organização e relatório, não de controle de acesso.

## Consequências

**Boas.** A regra de acesso é uma só e cabe em três linhas. Uma query nunca
atravessa households por construção, já que tudo vive sob o mesmo caminho.
Adicionar alguém à família é criar um documento; remover é apagá-lo. A pessoa
sozinha não paga complexidade: ela tem um household de um membro.

**Ruins.** Uma despesa pessoal dentro de um household é visível aos demais
membros. Isso é deliberado — o limite de privacidade é o household, e quem
quer privacidade real usa outro household. A alternativa (permissão por
documento) tornaria as regras muito mais caras de avaliar e de auditar.

Mover dados entre households não é uma operação suportada.
