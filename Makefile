default: develop

install:
	bundle install

develop: install
	bundle exec jekyll serve --livereload

build: install
	bundle exec jekyll build

check_links: build
	bundle exec htmlproofer --ignore-empty-alt --allow-hash-href --swap-urls "^\/426:" --ignore-urls "/www.linkedin.com/,/learningsuite.byu.edu/" ./_site

deploy: build
	rsync -avz _site/* philipbl@ssh.et.byu.edu:/fsj/philipbl/groups/net-lab/www/
