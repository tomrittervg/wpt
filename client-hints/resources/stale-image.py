import os.path

def main(request, response):

    token = request.GET.first("token", None)
    is_query = request.GET.first("query", None) != None
    with request.server.stash.lock:
      stash = request.server.stash.take(token)
      if stash != None:
        (value, ua_prev) = stash
        count = int(value)
      else:
        count = 0
        ua_prev = ""
      if is_query:
        if count < 2:
          request.server.stash.put(token, (count, request.headers.get('sec-ch-ua')))
      else:
        count = count + 1
        request.server.stash.put(token, (count, request.headers.get('sec-ch-ua')))

    if is_query:
      headers = [
        ("Count", count),
        ("ua-received", request.headers.get('sec-ch-ua')),
        ("ua-previous", ua_prev)
      ]
      content = ""
      return 200, headers, content
    else:
      filename = "green-16x16.png"
      if count > 1:
        filename = "green-256x256.png"

      path = os.path.join(os.path.dirname(__file__), "../../images", filename)
      body = open(path, "rb").read()

      response.add_required_headers = False
      response.writer.write_status(200)
      response.writer.write_header("content-length", len(body))
      response.writer.write_header("Cache-Control", "private, max-age=0, stale-while-revalidate=60")
      response.writer.write_header("content-type", "image/png")
      response.writer.write_header("ua-received", request.headers.get('sec-ch-ua'))
      response.writer.write_header("ua-previous", ua_prev)
      response.writer.end_headers()
      response.writer.write(body)
