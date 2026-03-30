# og-lambda.tf - OG Lambda: same Rust binary deployed as two Lambda functions
#
# Reads index.html + og-metadata.json from S3, stamps per-route OpenGraph
# tags into the HTML, returns it to CloudFront. One binary, two deployments
# with different env vars (viewer vs pics).

# -----------------------------------------------------------------------------
# Lambda Binary (built by cargo lambda, shared across both deployments)
# -----------------------------------------------------------------------------

data "archive_file" "og_server" {
  type        = "zip"
  source_file = "${path.module}/../../backend/target/lambda/og-server/bootstrap"
  output_path = "${path.module}/../../backend/target/lambda/og-server/bootstrap.zip"
}

# -----------------------------------------------------------------------------
# IAM Role
# -----------------------------------------------------------------------------

resource "aws_iam_role" "og_lambda" {
  name = "${var.prefix}-og-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "og_lambda_basic" {
  role       = aws_iam_role.og_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "og_lambda_s3" {
  name = "${var.prefix}-og-lambda-s3"
  role = aws_iam_role.og_lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = [
        "${aws_s3_bucket.static_site.arn}/index.html",
        "${aws_s3_bucket.static_site.arn}/og-metadata.json",
        "${aws_s3_bucket.pics_static.arn}/index.html",
        "${aws_s3_bucket.pics_static.arn}/og-metadata.json",
      ]
    }]
  })
}

# -----------------------------------------------------------------------------
# Viewer OG Lambda
# -----------------------------------------------------------------------------

resource "aws_lambda_function" "viewer_og" {
  function_name    = "${var.prefix}-og-server"
  role             = aws_iam_role.og_lambda.arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["x86_64"]
  timeout          = 10
  memory_size      = 512

  filename         = data.archive_file.og_server.output_path
  source_code_hash = data.archive_file.og_server.output_base64sha256

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.static_site.id
      SITE_URL  = "https://${local.primary_domain}"
    }
  }
}

resource "aws_lambda_function_url" "viewer_og" {
  function_name      = aws_lambda_function.viewer_og.function_name
  authorization_type = "NONE"
}

# -----------------------------------------------------------------------------
# Pics OG Lambda
# -----------------------------------------------------------------------------

resource "aws_lambda_function" "pics_og" {
  function_name    = "${var.pics_prefix}-og-server"
  role             = aws_iam_role.og_lambda.arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["x86_64"]
  timeout          = 10
  memory_size      = 512

  filename         = data.archive_file.og_server.output_path
  source_code_hash = data.archive_file.og_server.output_base64sha256

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.pics_static.id
      SITE_URL  = "https://${var.pics_domain}"
    }
  }
}

resource "aws_lambda_function_url" "pics_og" {
  function_name      = aws_lambda_function.pics_og.function_name
  authorization_type = "NONE"
}
