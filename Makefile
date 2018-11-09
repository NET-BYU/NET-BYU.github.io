build:
	jekyll build

serve:
	jekyll serve

deploy: build
	rsync -avz _site/* philipbl@shell.cs.utah.edu:/uusoc/res/ansrg/public_html/

