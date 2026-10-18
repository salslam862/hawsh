# Houshak 2.10.18 — Owner Form Recovery

Base: 2.10.17.

This release preserves the 2.10.17 codebase and specifically restores/strengthens the asset-owner form:
- owner name search field
- live existing-owner suggestions
- identity type
- identity number
- owner phone
- selecting an existing owner fills the owner data
- existing-owner fields are protected from accidental edits
- new-owner fields remain available inline
- owner search falls back to the offline owner cache when the network is unavailable

No unrelated feature was rebuilt.
