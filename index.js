const express         = require('express')
const Metalsmith      = require('metalsmith')
const markdown        = require('metalsmith-markdown')
const layouts         = require('metalsmith-layouts')
const StoryblokClient = require('storyblok-node-client')

/*******
* 
* Default Setup of Metalsmith, but wrapped in a function
* so we can trigger the build from the node Express Server 
* (for instant preview only) below.
*
********/
const build = (finish) => {
  Metalsmith(__dirname)
  .metadata({
    title: "My Static Site & Blog",
    description: "It's about saying »Hello« to the World.",
    generator: "Metalsmith",
    generator_url: "http://www.metalsmith.io",
    cms: "Storyblok",
    cms_url: "https://www.storyblok.com"
  })
  .use(storyblok)
  .source('./src')
  .destination('./build')
  .use(markdown())
  .use(layouts({
    engine: 'handlebars',
    partials: 'partials'
  }))
  .build(function(err, files) {
    if (err) { throw err }
    finish()
  })
}


/*******
*
* Custom Storyblok Plugin which uses the Storyblok Node Client
* to load every Story from the Content Delivery API and 
* inject the content entries written in Storyblok to the
* `files` for the Metalsmith workflow.
*
* Also Content-Types in Storyblok will be matched to layouts in
* Metalsmith.
*
*******/

const storyblok = (files, metalsmith, done) => {
  let metadata = metalsmith.metadata()

  let Storyblok = new StoryblokClient({
    privateToken: 'qR6GM4L0j1w4h2fFZiZ28Qtt'
  })

  Storyblok.get('stories', {
    version: 'draft', // change this to published for production build
    v: Date.now()
  })
  .then((response) => {

    // iterate through every Story created in Storyblok
    // and inject it's content into the metalsmith workflow by
    // creating a property -> property value pair for each
    // content entry. (http://www.metalsmith.io/#how-does-it-work-in-more-detail-)

    for (let index = 0, max = response.body.stories.length; index < max; index++) {
      let story = response.body.stories[index];
        
      // Metalsmith wants to create a file according to that key
      let key = story.full_slug + '/index.html'

      // the actual Content from Storyblok as value
      let value = story

      // "contents" needed otherwise "metalsmith-layouts" simply breaks.
      value['contents'] = new Buffer('', encoding='utf8') 

      // content type in storyblok equals to layout (page = page, post = post, ...)
      value['layout'] =  story.content.component + '.html'

      // assign new "file" from Storyblok to metalsmiths workflow
      files[key] = value
    } 

    // continue with normal workflow
    setImmediate(done)
  })
  .catch((error) => {
    console.log(error)
  })
}


/******
*
* Simple Express App to serve the static files
* trigger rebuilds via /rebuild to allow
* instant previews.
*
******/

const app  = express()
const port = 4000

// Serve the folder "build"
app.use(express.static('build'))

// Allows us to trigger the rebuild using a simple
// GET request from everywhere if the express server
// is running.
app.get('/rebuild', (req, res) => {
  res.write('Rebuild Started\n');
  console.log('Rebuild Started');

  build(() => { 
    console.log('Rebuild done');
    res.write('Rebuild done');
    res.end()
  })
})

// Catch those 404 pages and start rebuilding
// Why? Because if you create a new page you would
// like to see it already - even if it's empty.
app.get('*', (req, res) => {
  console.log('Rebuild Started');
  build(() => { 
     console.log('Rebuild done');
    res.write('<html>');
    res.write('<body style="text-align:center">');
    res.write('<h1>Building site...</h1>');
    res.write('<a href="#" onClick="window.location.reload()">Refresh</a>')
    res.write('</body>');
    res.write('</html>');
    res.end()
  })
});

// Listen to Port 4000 and start initial build
app.listen(port, () => {
  console.log('Rebuild Server listening on %s ...', port)
  console.log('Initial build started')
  build(() => { console.log('Initial build ended') })
})



