# Privacy Rules

This repository is designed to be safe for public GitHub hosting.

## Public Repository Rules

Tracked source files must not contain private contact data, private reference documents, generated print data, or generated PDFs. The public CV source in `data/cv.yml` may contain only public-safe information, including the broad location `Belgique / Luxembourg`.

Do not commit raw personal contact details, precise home or location details, private CV PDFs, reference CV files, generated print JSON, or generated PDFs.

## Private Overlay

Private contact data belongs in:

```txt
data/private/cv.private.yml
```

That file is ignored by Git. Create it locally by copying:

```txt
data/private/cv.private.example.yml
```

Then replace the placeholder values with private contact details for local print and PDF generation only.

## Private Print Data

Print JSON can include contact details that are not safe for the public website. For that reason, print JSON is generated only for local PDF generation and must stay under the ignored `generated/` directory.

The public website build must use only public web JSON. It must not output private print routes.

## Generated PDFs

Generated PDFs are private artifacts because they may include private contact details. They are reproducible from the public CV source plus the private overlay, so they should not be committed.

## Future CV Request Workflow

A future public workflow can let visitors request a CV instead of downloading private files directly from the public site. That flow should keep private contact data and generated PDFs outside tracked source files and expose only reviewed, intentional artifacts.
