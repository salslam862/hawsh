# Houshak 2.10.58 — Contract page balance

- Set equal A4 page margins on both left and right.
- Center the contract content block within the printable width and remove asymmetric horizontal padding.
- Justify long contract body lines while keeping each paragraph's final line aligned to the right, preserving Arabic RTL reading order.
- Allow long inline contract details to wrap instead of pushing the page layout sideways.
- Bumped admin/client service-worker caches to ensure updated print styles load.
- No database schema or production data changes.

Validation: automated tests, JavaScript syntax checks, and ZIP integrity check should be run for this release. Print appearance still needs visual confirmation on the target mobile browser/printer.
