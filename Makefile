default: develop

install:
	bundle install

develop: install
	bundle exec jekyll serve --livereload

build: install
	bundle exec jekyll build

check_links: build
	bundle exec htmlproofer --empty_alt_ignore --allow-hash-href --url-swap "^\/426:" --url-ignore "/www.linkedin.com/,/learningsuite.byu.edu/" --check-html ./_site

deploy: build
	rsync -avz _site/* philipbl@ssh.et.byu.edu:/fsj/philipbl/groups/net-lab/www/
