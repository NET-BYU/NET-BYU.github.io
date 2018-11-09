build:
	jekyll build

serve:
	jekyll serve

deploy: build
	rsync -avz _site/* philipbl@ssh.et.byu.edu:/fsj/philipbl/groups/net-lab/www/
