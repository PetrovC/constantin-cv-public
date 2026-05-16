using CvGenerator.Application;
using CvGenerator.Infrastructure;
using CvGenerator.Pdf;

return await CliProgram.RunAsync(args);

internal static class CliProgram
{
    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Length == 0 || IsHelp(args[0]))
        {
            WriteHelp();
            return args.Length == 0 ? 1 : 0;
        }

        return args[0] switch
        {
            "validate" => await ValidateAsync(args),
            "generate" => await GenerateAsync(args),
            "generate-pdf" => await GeneratePdfAsync(args),
            _ => WriteUnknownCommand(args[0])
        };
    }

    private static async Task<int> ValidateAsync(string[] args)
    {
        var input = GetOption(args, "--input");
        if (input is null)
        {
            Console.Error.WriteLine("Missing required option: --input");
            return 1;
        }

        try
        {
            var reader = new FileCvDocumentReader();
            var document = await reader.ReadAsync(input);
            var result = new CvValidationService().Validate(document);

            if (result.IsValid)
            {
                Console.WriteLine($"CV validation succeeded: {input}");
                return 0;
            }

            WriteValidationErrors($"CV validation failed: {input}", result.Errors);
            return 1;
        }
        catch (Exception ex) when (ex is ArgumentException or FileNotFoundException or IOException or InvalidDataException)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static async Task<int> GenerateAsync(string[] args)
    {
        var input = GetOption(args, "--input");
        if (input is null)
        {
            Console.Error.WriteLine("Missing required option: --input");
            return 1;
        }

        var output = GetOption(args, "--output");
        if (output is null)
        {
            Console.Error.WriteLine("Missing required option: --output");
            return 1;
        }

        try
        {
            var reader = new FileCvDocumentReader();
            var document = await reader.ReadAsync(input);
            var generationResult = new WebJsonGenerationService().Generate(document);

            if (!generationResult.IsSuccess)
            {
                WriteValidationErrors($"CV generation failed validation: {input}", generationResult.ValidationResult.Errors);
                return 1;
            }

            var writer = new FileWebJsonArtifactWriter();
            var writtenFiles = await writer.WriteAsync(output, generationResult.Artifacts);

            Console.WriteLine($"Generated {writtenFiles.Count} web JSON artifact(s) in {Path.Combine(output, "web")}");
            foreach (var file in writtenFiles)
            {
                Console.WriteLine($"- {file}");
            }

            return 0;
        }
        catch (Exception ex) when (ex is ArgumentException or FileNotFoundException or IOException or InvalidDataException)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static async Task<int> GeneratePdfAsync(string[] args)
    {
        var input = GetOption(args, "--input");
        if (input is null)
        {
            Console.Error.WriteLine("Missing required option: --input");
            return 1;
        }

        var privateInput = GetOption(args, "--private-input");
        if (privateInput is null)
        {
            Console.Error.WriteLine("Missing required option: --private-input");
            return 1;
        }

        var output = GetOption(args, "--output");
        if (output is null)
        {
            Console.Error.WriteLine("Missing required option: --output");
            return 1;
        }

        try
        {
            var reader = new FileCvDocumentReader();
            var privateReader = new FileCvPrivateOverlayReader();
            var document = await reader.ReadAsync(input);
            var privateOverlay = await privateReader.ReadAsync(privateInput);
            var privateOverlayService = new CvPrivateOverlayService();
            var privateValidationResult = privateOverlayService.Validate(privateOverlay);

            if (!privateValidationResult.IsValid)
            {
                WriteValidationErrors(
                    $"Private CV overlay validation failed: {privateInput}",
                    privateValidationResult.Errors);
                return 1;
            }

            var printDocument = privateOverlayService.Apply(document, privateOverlay);
            var printGenerationResult = new PrintJsonGenerationService().Generate(printDocument);
            if (!printGenerationResult.IsSuccess)
            {
                WriteValidationErrors(
                    $"Print CV generation failed validation: {input}",
                    printGenerationResult.ValidationResult.Errors);
                return 1;
            }

            var frenchArtifact = printGenerationResult.Artifacts
                .FirstOrDefault(artifact => artifact.Language == "fr");
            if (frenchArtifact is null)
            {
                Console.Error.WriteLine("Print generation did not produce the required French artifact.");
                return 1;
            }

            var writtenPdfFiles = new CvPdfGenerator().Generate(frenchArtifact.Content, output);

            Console.WriteLine($"Generated {writtenPdfFiles.Count} CV PDF(s) in {Path.Combine(output, "pdf", "fr")}");
            foreach (var file in writtenPdfFiles)
            {
                Console.WriteLine($"- {file}");
            }

            return 0;
        }
        catch (Exception ex) when (ex is ArgumentException or FileNotFoundException or IOException or InvalidDataException)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static string? GetOption(string[] args, string name)
    {
        for (var index = 0; index < args.Length - 1; index++)
        {
            if (args[index] == name)
            {
                return args[index + 1];
            }
        }

        return null;
    }

    private static bool IsHelp(string value)
        => value is "-h" or "--help" or "help";

    private static void WriteValidationErrors(
        string heading,
        IReadOnlyList<CvGenerator.Domain.CvValidationError> errors)
    {
        Console.Error.WriteLine(heading);
        foreach (var error in errors)
        {
            Console.Error.WriteLine($"- {error.Path}: {error.Message}");
        }
    }

    private static int WriteUnknownCommand(string command)
    {
        Console.Error.WriteLine($"Unknown command: {command}");
        WriteHelp();
        return 1;
    }

    private static void WriteHelp()
    {
        Console.WriteLine("CvGenerator");
        Console.WriteLine();
        Console.WriteLine("Commands:");
        Console.WriteLine("  validate --input <path>  Validate the CV source file.");
        Console.WriteLine("  generate --input <path> --output <path>");
        Console.WriteLine("  generate-pdf --input <path> --private-input <path> --output <path>");
    }
}
