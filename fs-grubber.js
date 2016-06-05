'use strict'

require('consoleplusplus');
var request = require('request');
var cheerio = require('cheerio');
var grubber = module.exports = {
	urls: {
		films: 'https://brb.to/video/films/'
	},
	films: {
		init: function(next) {
			grubber.films.list(next);
		},
		list: function(next) {
			console.time('FS list');
			new Promise(function(resolve, reject) {
				request(grubber.urls['films'], function(error, response, body) {
					if (!error) {
						var $ = cheerio.load(body),
							list = $('.b-section-list table'), 
							a, title, filmsList = [];

						list.each(function(i, ent) {
							$(ent).find('td').each(function(x, td) {
								a = $(td).find('a:first-child');
								title = a.find('.b-poster-tile__title-short').text().trim();
								filmsList.push({
									title: title,
									poster: grubber.films.getPoster($, td),
									link: a.attr('href')
								});
							});
						});
						filmsList.length ? 
							resolve(filmsList) : 
							reject( new Error('There\'s no requested table') );
					} else reject( new Error(error) );
				});
			})
			.then(function(l) { next({ list: l }) })
			.catch(function(e) { next({ error: e }) });
			console.timeEnd('FS list');
		},
		getPoster: function($, td) {
			if (!$ || !td) return;
			var tmpSrc = $(td).find('.b-poster-tile__image img').attr('src'),
				reg = /6(\/[\d]*\.\w{3}$)/g;
			return tmpSrc.replace(reg, '1$1');
		},
		getStream: function(url, next) {
			if (!url) next({ error: 'grubber.getStream::Need pass url!' });

			// https://fs.to/video/serials/view_iframe/i1KvkwXlG87tPHYEZQnFz2g
			// ?play&file=200434&frame_hash=q6fe7f&isStartRequest=true

			var reg = /^\/(\w*\/?){2}([\w\d]*)[-\w.]*/g,
				filmID = url.replace(reg, '$2'),
				filesPage = ['https://brb.to', url, '?ajax&id=', filmID, '&folder=0'].join(''),
				opts = {
					url: filesPage,
					method: 'GET',
					headers: {
						'X-Requested-With': 'XMLHttpRequest'
					}
				}, $, folderID, folderLink, streamLink, dlLink;

			console.time('FS stream');
			new Promise(function(resolve, reject) {
				request(opts, function(error, response, body) {
					if (!error) {
						$ = cheerio.load(body);
						folderLink = $('.link-subtype.m-ru');
						if (folderLink.length) {
							folderID = folderLink.attr('rel').replace(/{[\w_:\s]*\'(\d*)'}/g, '$1');
							resolve( opts.url.replace(/\d$/g, folderID) );
						} else reject( new Error('There\'s no folder with ru lang on the page') );
					} else reject( new Error(error) );
				});
			})
			.then(function(url) {
				return new Promise(function(resolve, reject) {
					request(url, function(error, response, body) {
						if (!error) {
							$ = cheerio.load(body);
							folderLink = $('.link-subtype').first();
							folderID = folderLink.attr('name').replace(/\w(\d*)/g, '$1');
							resolve( opts.url.replace(/\d+$/g, folderID) );
						} else reject( new Error(error) );
					});
				});
			})
			.then(function(url) {
				return new Promise(function(resolve, reject) {
					request(url, function(error, response, body) {
						if (!error && body) {
							dlLink = body.match(/\/get\/dl\/[a-z0-9.]+/g);
							streamLink = dlLink[0] && dlLink[0].match(/([a-z0-9.]{4,})/g);
							resolve(['http://brb.to/get/playvideo/', streamLink, '.mp4'].join(''));
						} else reject( new Error(error) );
					});
				})
			})
			.then(function(s) { next({ stream: s }) })
			.catch(function(e) { next({ error: e }) });
			console.timeEnd('FS stream');
		}
	}
};