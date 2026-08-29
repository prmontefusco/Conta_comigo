# Decisões arquiteturais

Registros das decisões que seriam caras de reverter ou difíceis de reconstituir
pelo código. Uma decisão entra aqui quando alguém, seis meses depois, teria
motivo para perguntar "por que assim?".

| #                                            | Decisão                                                          | Estado |
| -------------------------------------------- | ---------------------------------------------------------------- | ------ |
| [0001](0001-household-as-tenant.md)          | O household é o limite multi-tenant                              | aceito |
| [0002](0002-client-side-data-access.md)      | Acesso a dados pelo cliente, com Security Rules como autorização | aceito |
| [0003](0003-money-as-integer-minor-units.md) | Dinheiro como inteiro em centavos                                | aceito |
| [0004](0004-forecast-engine-is-pure.md)      | O motor de previsão não depende de Firestore                     | aceito |
| [0005](0005-calendar-dates-vs-instants.md)   | Datas de calendário e instantes são tipos diferentes             | aceito |
| [0006](0006-single-obligation-stream.md)     | Uma coleção `obligations`, não `payables` + `receivables`        | aceito |
| [0007](0007-derived-card-statements.md)      | Faturas e parcelas são derivadas, não armazenadas                | aceito |
| [0008](0008-nextjs-version.md)               | Next.js 15.5, e não a versão mais recente                        | aceito |
| [0009](0009-server-side-payments.md)         | Uma superfície de servidor, exclusivamente para pagamentos       | aceito |

## Formato

Contexto, decisão, consequências — incluindo as ruins. Um ADR que só lista
vantagens não está registrando uma decisão, está justificando uma preferência.

Decisões não são editadas depois de aceitas. Quando uma muda, escreve-se um novo
ADR que a substitui, e o antigo passa a `substituído por NNNN`.
