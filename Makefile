build:
	docker-compose build
integration-test:
	./bin/run_integration_tests.sh
format-js:
	docker-compose run --rm js-devtools format
format: format-js
format-check:
	git diff --exit-code tests/  # fail if js isn't formatted
emulator-shell:
	docker-compose exec emulator /bin/bash
